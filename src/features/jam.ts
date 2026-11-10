import {
    ActionRowBuilder,
    ButtonBuilder, ButtonInteraction,
    ChannelSelectMenuBuilder, ChannelType, type ChatInputCommandInteraction,
    Guild,
    type GuildMember, LabelBuilder,
    type LabelModalData, MessageFlags, ModalBuilder, type ModalSubmitInteraction, RoleSelectMenuBuilder,
    type SelectMenuModalData, StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder, type TextBasedChannel,
    TextInputBuilder, type TextInputModalData,
    ThreadChannel, UserSelectMenuBuilder
} from "discord.js";
import {type Database} from "better-sqlite3";

interface Submission {
    user: GuildMember,
    name: string,
    thread: ThreadChannel,
    voters: Set<string>
}

interface Jam {
    id: number,
    name: string,
    channel: TextBasedChannel,
    submissions: Map<string, Submission>,
    canVote: (user: GuildMember) => boolean,
    startDate: number,
    endDate: number,
    role: string | undefined
}

export class VoteSystem {
    private readonly insertJam
    private readonly updateJam
    private readonly upsertVoter
    private readonly insertSubmission

    private readonly Guild: Guild

    private readonly Jams: Map<number, Jam>
    private readonly Votes: Map<number, Map<string, string>>


    private newestJam: number = 0
    private activeJam: number | undefined
    public getActiveJam = () => this.activeJam
    public getNewestJam = () => this.newestJam

    static async create(db: Database, guild: Guild): Promise<VoteSystem> {
        const instance = new VoteSystem(db, guild);
        await instance.loadSubmissions(db);
        return instance;
    }

    private async loadSubmissions(db: Database) {
        for (const sub of db.prepare("SELECT * FROM submissions").all() as {user: string, jam: number, name: string, thread: string}[]) {
            const jam = this.Jams.get(sub.jam)
            if (jam === undefined) {
                console.error(`Unknown Jam: ${sub.jam}`)
                continue
            }
            const user = await this.Guild.members.fetch(sub.user).catch(() => null)
            if (user === null) {
                console.error(`Unknown User: ${sub.user}`)
                continue
            }
            const thread = await this.Guild.channels.fetch(sub.thread)
            if (thread === null || !thread.isThread()) {
                console.error(`Unknown Thread: ${sub.thread}`)
                continue
            }
            jam.submissions.set(sub.user, {user: user, name: sub.name, thread: thread as ThreadChannel, voters: new Set()})
        }
        for (const vote of db.prepare("SELECT * FROM votes").all() as {user: string, jam: number, submission: string}[]) {
            const jam = this.Jams.get(vote.jam)
            const votes = this.Votes.get(vote.jam)
            if (jam === undefined || votes === undefined) {
                console.error(`Unknown Jam: ${vote.jam}`)
                continue
            }
            const sub = jam.submissions.get(vote.submission)
            if (sub === undefined) {
                console.error(`Unknown Submission: ${vote.submission}`)
                continue
            }
            sub.voters.add(vote.user)
            votes.set(vote.user, vote.submission)
        }
    }

    private constructor(db: Database, guild: Guild) {
        this.insertJam = db.prepare("INSERT INTO jams (name, channel, startDate, endDate, role) VALUES (?, ?, ?, ?, ?)")
        this.updateJam = db.prepare("UPDATE jams SET (startDate, endDate) = (?, ?) WHERE id = ?")
        this.upsertVoter = db.prepare("INSERT INTO votes (user, jam, submission) VALUES (?, ?, ?) ON CONFLICT(user, jam) DO UPDATE SET submission = excluded.submission")
        this.insertSubmission = db.prepare("INSERT INTO submissions (user, jam, name, thread) VALUES (?, ?, ?, ?)")
        this.Guild = guild

        this.Jams = new Map()
        this.Votes = new Map()
        for (const jam of db.prepare("SELECT * FROM jams").all() as {id: number, name: string, channel: string, role: string | undefined, startDate: number, endDate: number}[]) {
            const channel = this.Guild.channels.cache.get(jam.channel)
            if (channel === undefined || !channel.isTextBased()) {
                console.error(`Unknown Channel: ${jam.channel}`)
                continue
            }
            const vote = (user: GuildMember): boolean => {
                const joined = (user.joinedTimestamp ?? 0) < jam.startDate
                return joined && (jam.role === undefined || user.roles.cache.has(jam.role))
            }
            this.Jams.set(jam.id, {id: jam.id, name: jam.name, channel: channel, submissions: new Map(), canVote: vote, startDate: jam.startDate, endDate: jam.endDate, role: jam.role})
            this.Votes.set(jam.id, new Map())

            if((this.activeJam ?? 0) < jam.id && jam.endDate > Date.now() && jam.startDate < Date.now()) this.activeJam = jam.id
            if(this.newestJam < jam.id) this.newestJam = jam.id
        }

    }

    public setVote(jamId: number, user: string, submission: string) {
        const jam = this.Jams.get(jamId)
        const votes = this.Votes.get(jamId)
        if (votes === undefined || jam === undefined) {
            console.error(`Unknown Jam: ${jamId}`)
            return
        }
        const userObj = this.Guild.members.cache.get(user)
        if (userObj === undefined) {
            console.error(`Unknown User: ${user}`)
            return
        }
        if (!jam.canVote(userObj)) {
            console.error(`Can't vote: ${user}`)
            return
        }
        const target = jam.submissions.get(submission)
        if (target === undefined) {
            console.error(`Unknown Submission: ${jamId}@${submission}`)
            return
        }

        const current = votes.get(user)

        if (current === submission) {
            return
        }

        this.upsertVoter.run([user, jamId, submission])

        if (current !== undefined) {
            jam.submissions.get(current)?.voters.delete(user)
        }

        target.voters.add(user)
        votes.set(user, submission)
    }
    public getVote(jamId: number, user: string): Submission | undefined {
        const jam = this.Jams.get(jamId)
        const votes = this.Votes.get(jamId)
        if (votes === undefined || jam === undefined) {
            console.error(`Unknown Jam: ${jamId}`)
            return
        }

        const submission = votes.get(user)
        return submission === undefined ? undefined : jam.submissions.get(submission)
    }

    public getSubmission(jamId: number, user: string) {
        const jam = this.Jams.get(jamId)
        if (jam === undefined) {
            console.error(`Unknown Jam: ${jamId}`)
            return
        }

        return jam.submissions.get(user)
    }
    public addSubmission(jamId: number, userId: string, name: string, threadId: string): Submission | undefined {
        const jam = this.Jams.get(jamId)
        if (jam === undefined) {
            console.error(`Unknown Jam: ${jamId}`)
            return
        }

        if(jam.submissions.has(userId)) {
            console.error(`Duplicate Submission: ${jamId}@${userId}`)
            return
        }

        const user = this.Guild.members.cache.get(userId)
        if (user === undefined) {
            console.error(`Unknown User: ${userId}`)
            return
        }
        const thread = this.Guild.channels.cache.get(threadId)
        if (thread === undefined || !thread.isThread()) {
            console.error(`Unknown Thread: ${threadId}`)
            return
        }

        this.insertSubmission.run(userId, jamId, name, threadId)
        const submission: Submission = {user: user, name: name, thread: thread, voters: new Set()}
        jam.submissions.set(userId, submission)
        return submission
    }

    public getJam = (jamId: number) => this.Jams.get(jamId)
    public addJam(channel: TextBasedChannel, name: string, startDate: number, endDate: number, role: string | undefined): Jam {
        const vote = (user: GuildMember): boolean => {
            const joined = (user.joinedTimestamp ?? 0) < startDate
            return joined && (role === undefined || user.roles.cache.has(role))
        }
        const id = Number(this.insertJam.run(name, channel.id, startDate, endDate, role).lastInsertRowid)
        const jam: Jam = {id, name, channel, submissions: new Map(), canVote: vote, startDate, endDate, role}
        this.Jams.set(id, jam)
        this.newestJam = id
        this.Votes.set(id, new Map())
        return jam
    }

    public endJam(silent: boolean = false): string | undefined {
        if (this.activeJam === undefined) return "Couldn't end the vote, there isn't an active vote."

        const jam = this.getJam(this.activeJam)!
        this.activeJam = undefined
        jam.endDate = Date.now()

        this.updateJam.run(jam.startDate, jam.endDate, jam.id)

        if(silent) return

        if(!jam.channel.isSendable()) {
            console.error(`Can't send message in channel ${jam.channel.id}`)
            return
        }

        const submissions = [...jam.submissions.values()].sort((a, b) => b.voters.size - a.voters.size)

        const msg =
`The vote for the winner of ${jam.name} has concluded. Thanks for voting!
There were a total of ${this.Votes.get(jam.id)?.size} Voters.
The Winners are:
**🥇 1st Place**: ${submissions[0]!.user.displayName} – ${submissions[0]!.name} with ${submissions[0]!.voters.size} votes
🥈 2nd Place: ${submissions[1]!.user.displayName} – ${submissions[1]!.name} with ${submissions[1]!.voters.size} votes
${submissions.length >= 3 ? `*🥉 3rd Place*: ${submissions[2]!.user.displayName} – ${submissions[2]!.name} with ${submissions[2]!.voters.size} votes` : ""}`

        void jam.channel.send({
            content: msg
        }).catch(console.error)
    }

    public startJam(): string | undefined {
        if((this.getJam(this.newestJam)?.submissions.size ?? 0) < 2) return "Couldn't start the vote, you need at least 2 submissions. There are: " + (this.getJam(this.newestJam)?.submissions.size)
        if(this.activeJam === this.newestJam) return "Couldn't start the vote, the vote is already going."
        if(this.activeJam !== undefined) return "Couldn't start the vote, another vote is still going."

        this.activeJam = this.newestJam
        const jam = this.getJam(this.activeJam)!
        jam.startDate = Date.now()

        this.updateJam.run(jam.startDate, jam.endDate, jam.id)

        if(!jam.channel.isSendable()) {
            console.error(`Can't send message in channel ${jam.channel.id}`)
            return
        }

        const voteButton = new ButtonBuilder()
            .setEmoji("📩")
            .setLabel("Vote!")
            .setCustomId("submission_vote")

        let msg =
`Hi there ${jam.role !== undefined ? `<@&${jam.role}>` : "everyone"},
Please take some time to vote the winner of ${jam.name}! The options are:

`

        for (const sub of jam.submissions.values()) {
            msg +=
`[${sub.user.displayName} – ${sub.name}](https://discord.com/channels/${this.Guild.id}/${sub.thread.id})
`
        }

        void jam.channel.send({
            content: msg,
            components: [new ActionRowBuilder().setComponents(voteButton).toJSON()],
            allowedMentions: {
                roles: jam.role !== undefined ? [jam.role] : []
            }
        }).catch(console.error)
    }

    public tick() {
        const jam = this.getJam(this.newestJam)
        if (jam === undefined) return
        if (jam.endDate < Date.now()) this.endJam()
        else if (jam.startDate < Date.now()) this.startJam()
    }
}

export async function handleVoteCommand(interaction: ChatInputCommandInteraction) {
    const modal = new ModalBuilder()
    modal.setCustomId("vote").setTitle("Vote")
        .addLabelComponents([
            new LabelBuilder().setLabel("Name").setDescription("Name of the Vote")
                .setTextInputComponent(new TextInputBuilder().setCustomId("name").setRequired(true)),
            new LabelBuilder().setLabel("Start Date").setDescription("Start date of the Vote as ISO timestamp. Voters have to have joined before this date to be able to vote.")
                .setTextInputComponent(new TextInputBuilder().setCustomId("start_date").setMinLength(20).setMaxLength(25).setValue("1970-01-01T00:00:00Z").setRequired(true)),
            new LabelBuilder().setLabel("End Date").setDescription("End date of the Vote as ISO timestamp.")
                .setTextInputComponent(new TextInputBuilder().setCustomId("end_date").setMinLength(20).setMaxLength(25).setValue("1970-01-01T00:00:00Z").setRequired(true)),
            new LabelBuilder().setLabel("Role").setDescription("Role of the roles allowed to vote, leave empty to allow everyone who joined before the start date")
                .setRoleSelectMenuComponent(new RoleSelectMenuBuilder().setCustomId("role").setRequired(false).setMaxValues(1)),
        ])

    await interaction.showModal(modal)
}

export async function handleVoteModal(interaction: ModalSubmitInteraction, voteSystem: VoteSystem) {
    if(interaction.channel === null) return
    let name: string | undefined
    let startDate: number = NaN
    let endDate: number = NaN
    let role: string | undefined
    for (const data of interaction.components as LabelModalData[]) {
        switch (data.component.customId) {
            case "name": name = (data.component as TextInputModalData).value
                break
            case "start_date": startDate = Date.parse((data.component as TextInputModalData).value)
                break
            case "end_date": endDate = Date.parse((data.component as TextInputModalData).value)
                break
            case "role": role = (data.component as SelectMenuModalData).roles?.first()?.id
        }
    }

    if(name === undefined || isNaN(startDate) || isNaN(endDate)) {
        console.error("Invalid Vote Modal")
        return
    }

    voteSystem.addJam(interaction.channel, name, startDate, endDate, role)

    const submission = new ButtonBuilder()
        .setEmoji("➕")
        .setCustomId("add_submission")
        .setLabel("Add Submission")

    const startVote = new ButtonBuilder()
        .setEmoji("✔️")
        .setCustomId("start_vote")
        .setLabel("Start Vote")

    const endVote = new ButtonBuilder()
        .setEmoji("❌")
        .setCustomId("end_vote")
        .setLabel("End Vote")

    const cancelVote = new ButtonBuilder()
        .setEmoji("⛔")
        .setCustomId("cancel_vote")
        .setLabel("Cancel Vote")

    await interaction.reply({
        content: "Created the vote successfully, press the buttons below to add submissions, start the vote or end the vote.",
        components: [new ActionRowBuilder().setComponents([submission, startVote, endVote, cancelVote]).toJSON()],
        flags: MessageFlags.Ephemeral
    })
}

export async function handleSubmissionModal(interaction: ModalSubmitInteraction, voteSystem: VoteSystem) {
    let user: string | undefined
    let name: string | undefined
    let thread: string | undefined

    for (const data of interaction.components as LabelModalData[]) {
        switch (data.component.customId) {
            case "user": user = (data.component as SelectMenuModalData).users?.first()?.id
                break
            case "name": name = (data.component as TextInputModalData).value
                break
            case "thread": thread = (data.component as SelectMenuModalData).channels?.first()?.id
                break
        }
    }

    if (user === undefined || name === undefined || thread === undefined) return

    const sub = voteSystem.addSubmission(voteSystem.getNewestJam(), user, name, thread)
    if (sub === undefined) {
        await interaction.reply({
            content: `Couldn't add submission, something went wrong.`,
            flags: MessageFlags.Ephemeral
        })
        return
    }

    await interaction.reply({
        content: `Added the submission successfully, there are now ${voteSystem.getJam(voteSystem.getNewestJam())?.submissions.size}.`,
        flags: MessageFlags.Ephemeral
    })
}

export async function handleSubmissionButton(interaction: ButtonInteraction) {
    const modal = new ModalBuilder().setCustomId("submission").setTitle("Submission")
        .addLabelComponents([
            new LabelBuilder().setLabel("User").setDescription("The creator of the submission.")
                .setUserSelectMenuComponent(new UserSelectMenuBuilder().setMinValues(1).setMaxValues(1).setRequired(true).setCustomId("user")),
            new LabelBuilder().setLabel("Name").setDescription("The name of the submission.")
                .setTextInputComponent(new TextInputBuilder().setRequired(true).setCustomId("name")),
            new LabelBuilder().setLabel("Thread").setDescription("The thread of the submission.")
                .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder().setCustomId("thread").setRequired(true).setMinValues(1).setMaxValues(1).setChannelTypes([ChannelType.PublicThread]))
        ])

    await interaction.showModal(modal)
}

export async function handleEndJamButton(interaction: ButtonInteraction, voteSystem: VoteSystem, silent: boolean) {
    const msg = voteSystem.endJam(silent)
    await interaction.reply({
        content: msg ?? `${silent ? "Canceled" : "Ended"} the vote successfully.`,
        flags: MessageFlags.Ephemeral
    })

}

export async function handleStartJamButton(interaction: ButtonInteraction, voteSystem: VoteSystem) {
    const msg = voteSystem.startJam()
    await interaction.reply({
        content: msg ?? "Started the vote successfully.",
        flags: MessageFlags.Ephemeral
    })
}

export async function handleVoteButton(interaction: ButtonInteraction, voteSystem: VoteSystem, change: boolean) {
    if (voteSystem.getActiveJam() === undefined) {
        let msg = "You can't vote right now!"
        if (voteSystem.getNewestJam() !== 0) {
            const jam = voteSystem.getJam(voteSystem.getNewestJam())!
            if (jam.endDate < Date.now()) {
                msg = "This vote has ended already!"
            }
        }
        await interaction.reply({
            content: msg,
            flags: MessageFlags.Ephemeral
        })
        return
    }
    const jam = voteSystem.getJam(voteSystem.getActiveJam()!)
    if (jam === undefined) {
        await interaction.reply({
            content: "Something went wrong while voting, try again later. If the issue persists please DM Grove about it!",
            flags: MessageFlags.Ephemeral
        })
        return
    }
    if (!jam.canVote(interaction.member as GuildMember)) {
        await interaction.reply({
            content: "You are not allowed to vote for this!",
            flags: MessageFlags.Ephemeral
        })
        return
    }

    if(voteSystem.getVote(jam.id, interaction.user.id) !== undefined && !change) {
        const sub = voteSystem.getVote(jam.id, interaction.id)!

        const voteButton = new ButtonBuilder()
            .setEmoji("📩")
            .setLabel("Change Vote")
            .setCustomId("submission_vote_change")

        await interaction.reply({
            content: `You have already voted. You voted for: ${sub.user.displayName} – ${sub.name}`,
            flags: MessageFlags.Ephemeral,
            components: [new ActionRowBuilder().setComponents(voteButton).toJSON()]
        })
        return
    }

    const modal = new ModalBuilder().setCustomId("submission_vote").setTitle(jam.name)
    const component = new StringSelectMenuBuilder().setMinValues(1).setMaxValues(1).setRequired(true).setCustomId("vote")

    for (const sub of jam.submissions.values()) {
        component.addOptions(new StringSelectMenuOptionBuilder().setLabel(`${sub.user.displayName} – ${sub.name}`.substring(0, 100)).setValue(sub.user.id))
    }

    modal.setLabelComponents(new LabelBuilder().setLabel("Submission").setDescription("The Submission you want to vote for.").setStringSelectMenuComponent(component))

    await interaction.showModal(modal)
}

export async function handleVoteSubmissionModal(interaction: ModalSubmitInteraction, voteSystem: VoteSystem) {
    const user = ((interaction.components[0] as LabelModalData).component as SelectMenuModalData).values[0]
    const jam = voteSystem.getJam(voteSystem.getActiveJam() ?? 0)

    if (user === undefined || jam === undefined) {
        await interaction.reply({
            content: "Something went wrong while voting, try again later. If the issue persists please DM Grove about it!",
            flags: MessageFlags.Ephemeral
        })
        return
    }

    voteSystem.setVote(jam.id, interaction.user.id, user)

    const voteButton = new ButtonBuilder()
        .setEmoji("📩")
        .setLabel("Change Vote")
        .setCustomId("submission_vote_change")

    await interaction.reply({
        content: `You voted for ${voteSystem.getSubmission(jam.id, user)?.name} by ${voteSystem.getSubmission(jam.id, user)?.user.displayName}!`,
        flags: MessageFlags.Ephemeral,
        components: [new ActionRowBuilder().setComponents(voteButton).toJSON()]
    })
}