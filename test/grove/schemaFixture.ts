// A small Apoli for the schema, verify and checked tests: Handbook pages in the
// real format, and registration and codec code shaped like the real mod's.
import { buildSchema, type Schema, type SchemaPage, type SchemaSource } from "../../src/grove/knowledge/schema.ts";

const HANDBOOK = "https://0vergrown.github.io/Handbook/docs/datapack";

function page(section: string, name: string, title: string, text: string): SchemaPage {
  return { path: `src/content/docs/datapack/${section}/${name}.md`, title, url: `${HANDBOOK}/${section.replace(/^\d+-/, "")}/${name}/`, text };
}

export const PAGES: SchemaPage[] = [
  page("02-powers", "action_on_hit", "Action On Hit (Power Type)", `Executes an action when the holder hits another entity.

**Type ID:** \`apoli:action_on_hit\`

Also answers to: \`apoli:target_action_on_hit\`

## Fields

| Field                 | Type                     | Default    | Description                                          |
| --------------------- | ------------------------ | ---------- | ---------------------------------------------------- |
| \`bientity_action\`     | Bi-entity Action Type    | _optional_ | Action run with the actor/target pair.               |
| \`target_action\`       | Entity Action Type       | _optional_ | Action run on the target (the entity that was hit).  |
| \`self_action\`         | Entity Action Type       | _optional_ | Action run on the actor (the entity that has the power). |
| \`cooldown\`            | [Integer](/docs/datapack/data-types/integer) | \`1\` | Ticks the power needs to recharge between fires.     |
| \`hud_render\`          | [Hud Render](/docs/datapack/data-types/hud-render) | \`{"should_render": false}\` | How the cooldown is shown. |

## Examples

## Knockback on hit

\`\`\`json
{
    "type": "apoli:action_on_hit",
    "bientity_action": {
        "type": "apoli:add_velocity",
        "z": 2
    }
}
\`\`\`

## Heal the attacker

\`\`\`json
{ "type": "apoli:action_on_hit", "self_action": { "type": "apoli:heal", "amount": 2 } }
\`\`\`
`),
  page("02-powers", "modify_damage", "Modify Damage (Power Type)", `Modifies damage.

Type ID: \`apoli:modify_damage\`

## Fields

Field | Type | Default | Description
------|------|---------|-------------
\`modifier\` | [Attribute Modifier](/docs/datapack/data-types/attribute-modifier) | _optional_ | A modifier.
\`damage_condition\` | [Damage Condition](/docs/datapack/damage-conditions) | _optional_ | Only this damage.
`),
  page("02-powers", "multiple", "Multiple (Power Type)", "Several powers in one file.\n\nType ID: `apoli:multiple`\n\n## Fields\n\nArbitrary fields."),
  page("02-powers", "tooltip", "Tooltip (Power Type)", "Adds a tooltip.\n\nType ID: `apoli:tooltip`\n\n## Fields\n\n| Field | Type | Default | Description |\n| --- | --- | --- | --- |\n| `text` | Text Component | | The text. |"),
  page("03-entity-actions", "heal", "Heal (Entity Action Type)", "Heals the entity.\n\nType ID: `apoli:heal`\n\n## Fields\n\n| Field | Type | Default | Description |\n| --- | --- | --- | --- |\n| `amount` | Float | | How much. |\n\n## Examples\n\n```json\n\"entity_action\": { \"type\": \"apoli:heal\", \"amount\": 2 }\n```"),
  page("03-entity-actions", "add_velocity", "Add Velocity (Entity Action Type)", "Pushes the entity.\n\nType ID: `apoli:add_velocity`\n\n## Fields\n\n| Field | Type | Default | Description |\n| --- | --- | --- | --- |\n| `y` | Float | `0` | Up. |"),
  page("04-bientity-actions", "add_velocity", "Add Velocity (Bi-entity Action Type)", "Pushes the target away from the actor.\n\nType ID: `apoli:add_velocity`\n\n## Fields\n\n| Field | Type | Default | Description |\n| --- | --- | --- | --- |\n| `z` | Float | `0` | Forward. |"),
  page("04-bientity-actions", "target_action", "Target Action (Bi-entity Action Type)", "Runs an entity action on the target.\n\nType ID: `apoli:target_action`\n\n## Fields\n\n| Field | Type | Default | Description |\n| --- | --- | --- | --- |\n| `action` | Entity Action Type | | The action. |"),
  page("07-meta-actions", "and", "And (Meta Action Type)", "Runs all of them.\n\nType ID: `apoli:and`\n\n## Fields\n\nField | Type | Default | Description\n------|------|---------|------------\n`actions` | [Array](/docs/datapack/data-types/array) of Action Types | | The actions."),
  page("07-meta-actions", "if_else", "If Else (Meta Action Type)", "Runs one of two actions.\n\nType ID: `apoli:if_else`\n\n## Fields\n\nField | Type | Default | Description\n------|------|---------|------------\n`condition` | Condition Type | | The check.\n`if_action` | Action Type | | When it passes.\n`else_action` | Action Type | _optional_ | When it fails."),
  page("08-entity-conditions", "sneaking", "Sneaking (Entity Condition Type)", "Checks for sneaking.\n\nType ID: `apoli:sneaking`\n\n## Fields\n\n_None._"),
  page("09-bientity-conditions", "either", "Either (Bi-Entity Condition Type)", "Either side passes.\n\nType ID: `apoli:either`\n\n## Fields\n\n| Field | Type | Default | Description |\n| --- | --- | --- | --- |\n| `condition` | Condition Type | | Tested on both. |"),
  page("09-bientity-conditions", "actor_condition", "Actor Condition (Bi-Entity Condition Type)", "Tests the actor.\n\nType ID: `apoli:actor_condition`\n\n## Fields\n\n| Field | Type | Default | Description |\n| --- | --- | --- | --- |\n| `condition` | Entity Condition Type | | The check. |"),
  page("15-meta-conditions", "offset", "Offset (Meta Condition Type)", "Tests another block.\n\nType ID: `apoli:offset`\n\n## Fields\n\n| Field | Type | Default | Description |\n| --- | --- | --- | --- |\n| `condition` | Condition Type | | The check. |\n| `y` | Integer | `0` | Up. |"),
  page("16-data-types", "model_part", "Model Part (Data Type)", "A part.\n\n```json\n{ \"channel\": { \"type\": \"apoli:pitch\" } }\n```"),
  page("16-data-types", "hud-render", "Hud Render (Data Type)", "How a bar is drawn.\n\n##\tFields\n\nField | Type | Default | Description\n------|------|---------|------------\n`should_render` | [Boolean](/docs/datapack/data-types/boolean) | `true` | Whether it shows.\n`bar_index` | [Integer](/docs/datapack/data-types/integer) | `0` | Which bar.\n`condition` | Entity Condition Type | _optional_ | When it shows."),
  page("16-data-types", "comparison", "Comparison (Data Type)", "How two numbers compare.\n\nComparison | Meaning\n-----------|--------\n`<` | less\n`<=` | less or equal\n`>` | more\n`>=` | more or equal\n`==` | equal\n`!=` | not equal"),
  page("08-entity-conditions", "relative_health", "Relative Health (Entity Condition Type)", "Health compared to max health.\n\nType ID: `apoli:relative_health`\n\n## Fields\n\n| Field | Type | Default | Description |\n| --- | --- | --- | --- |\n| `comparison` | [Comparison](/docs/datapack/data-types/comparison) | | How. |\n| `compare_to` | [Float](/docs/datapack/data-types/float) | | To what. |"),
  page("19-commands", "origin", "Origin (Command)", "Sets origins.\n\n## Sub-commands\n\n| Sub-command | What it does |\n|-------------|--------------|\n| `set <targets> <layer> <origin>` | Assigns an origin. |\n| `revoke <targets> <layer> [origin]` | Takes one back. |\n| `gui [<targets>] [<layer>]` | Reopens the screen. |"),
  page("19-commands", "disguise", "Disguise (Command)", "Disguises.\n\n## Sub-commands\n\n| Sub-command | What it does |\n|---|---|\n| `entity <targets> <entity_type>` | As an entity. |\n| `clear <targets>` | Removes it. |"),
  page("19-commands", "clone", "Clone (Command)", "Clones.\n\n## Sub-commands\n\n| Sub-command | What it does |\n|---|---|\n| `summon <owners> [<pos>] [<options>]` | Spawns clones. |"),
  page("18-origins/06-badge-types", "badge_tooltip", "Tooltip (Badge Type)", "A badge.\n\nType ID: `origins:tooltip`\n\n## Fields\n\n| Field | Type | Default | Description |\n| --- | --- | --- | --- |\n| `text` | Text | | Text. |\n| `sprite` | Identifier | | Icon. |"),
];

export const SOURCES: SchemaSource[] = [
  {
    namespace: "apoli",
    path: "src/main/java/dev/overgrown/apoli/power/PowerTypes.java",
    text: `public final class PowerTypes {
    private static final ModifyDamagePower MODIFY_DAMAGE = new ModifyDamagePower();
    public static void register() {
        PowerTypeRegistry.register(
            Apoli.id("action_on_hit"),
            new ActionOnHitPower(),
            AliasingOptions.builder()
                .addTypeAlias(Apoli.id("self_action_on_hit"))
                .build()
        );
        PowerTypeRegistry.register(Apoli.id("modify_damage"), MODIFY_DAMAGE,
            AliasingOptions.builder().addTypeAlias(Apoli.id("modify_damage_taken")).build());
        PowerTypeRegistry.register(Apoli.id("multiple"), new MultiplePower());
        PowerTypeRegistry.register(Apoli.id("tooltip"), new TooltipPower());
        PowerTypeRegistry.register(Apoli.id("secret_power"), new SecretPower());
    }
}`,
  },
  {
    namespace: "apoli",
    path: "src/main/java/dev/overgrown/apoli/power/builtin/ModifyDamagePower.java",
    text: `public final class ModifyDamagePower {
    static final MapCodec<Config> CODEC = RecordCodecBuilder.mapCodec(i -> i.group(
        dev.overgrown.apoli.codec.LoggedOptionalField.of("self_action", EntityAction.CODEC).forGetter(Config::selfAction),
        dev.overgrown.apoli.codec.LoggedOptionalField.strict("damage_condition", DamageCondition.CODEC).forGetter(Config::damageCondition),
        AttributeModifier.CODEC.optionalFieldOf("modifier").forGetter(Config::modifier),
        BiEntityCondition.CODEC.optionalFieldOf("bientity_condition").forGetter(Config::bientityCondition)
    ).apply(i, Config::new));
}`,
  },
  {
    namespace: "apoli",
    path: "src/main/java/dev/overgrown/apoli/action/builtin/entity/EntityActions.java",
    text: `public final class EntityActions {
    public static void register() {
        ActionTypes.ENTITY.register(Apoli.id("heal"), new HealAction());
        ActionTypes.ENTITY.register(Apoli.id("add_velocity"), new AddVelocityAction());
        ActionTypes.ENTITY.register(Apoli.id("set_on_fire"), new SetOnFireAction());
    }
}`,
  },
  {
    namespace: "apoli",
    path: "src/main/java/dev/overgrown/apoli/action/builtin/meta/MetaActions.java",
    text: `public final class MetaActions {
    private static final ResourceLocation AND = Apoli.id("and");
    private static final ResourceLocation IF_ELSE = Apoli.id("if_else");
    private static AliasingOptions chanceAliases() {
        return AliasingOptions.builder().addTypeAlias(Apoli.id("chance")).build();
    }
    public static void registerEntity() {
        TypedActionRegistry<EntityCtx> reg = ActionTypes.ENTITY;
        reg.register(AND, new AndMetaAction<>(EntityAction.CODEC, EntityAction::run));
        reg.register(IF_ELSE, new IfElseMetaAction<>(EntityCondition.CODEC, EntityAction.CODEC, EntityCondition::test, EntityAction::run));
        reg.register(Apoli.id("random_chance"), new RandomChanceMetaAction<>(EntityAction.CODEC), chanceAliases());
    }
    public static void registerBiEntity() {
        TypedActionRegistry<BiEntityCtx> reg = ActionTypes.BI_ENTITY;
        reg.register(AND, new AndMetaAction<>(BiEntityAction.CODEC, BiEntityAction::run));
        reg.register(IF_ELSE, new IfElseMetaAction<>(BiEntityCondition.CODEC, BiEntityAction.CODEC, BiEntityCondition::test, BiEntityAction::run));
    }
}`,
  },
  {
    namespace: "apoli",
    path: "src/main/java/dev/overgrown/apoli/condition/builtin/bientity/BiEntityConditions.java",
    text: `public final class BiEntityConditions {
    public static void register() {
        ConditionTypes.BI_ENTITY.register(Apoli.id("either"), new EitherCondition());
        ConditionTypes.BI_ENTITY.register(Apoli.id("actor_condition"), new ActorConditionCondition());
    }
}`,
  },
  {
    namespace: "apoli",
    path: "src/main/java/dev/overgrown/apoli/condition/builtin/bientity/EitherCondition.java",
    text: `public final class EitherCondition {
    public MapCodec<Cfg> codec() {
        return RecordCodecBuilder.mapCodec(i -> i.group(
            dev.overgrown.apoli.codec.LoggedOptionalField.strict("condition", EntityCondition.CODEC).forGetter(Cfg::condition)
        ).apply(i, Cfg::new));
    }
}`,
  },
  {
    namespace: "apoli",
    path: "src/main/java/dev/overgrown/apoli/condition/builtin/meta/MetaConditions.java",
    text: `public final class MetaConditions {
    public static void registerBlock() {
        TypedConditionRegistry<BlockCtx> reg = ConditionTypes.BLOCK;
        reg.register(Apoli.id("offset"), new OffsetBlockMetaCondition());
    }
}`,
  },
  {
    namespace: "apoli",
    path: "src/main/java/dev/overgrown/apoli/command/ApoliDisguiseCommand.java",
    text: `public final class ApoliDisguiseCommand {
    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        LiteralArgumentBuilder<CommandSourceStack> root = Commands.literal("apoli:disguise");
        root.then(Commands.literal("entity").then(Commands.argument("targets", EntityArgument.entities())));
        root.then(Commands.literal("query").then(Commands.argument("target", EntityArgument.entity())));
        root.then(Commands.argument("targets", EntityArgument.entities()).then(Commands.argument("as", StringArgumentType.word())));
        dispatcher.register(Commands.literal("disguise").redirect(dispatcher.register(root)));
    }
}`,
  },
  {
    namespace: "apoli",
    path: "src/main/java/dev/overgrown/apoli/condition/builtin/entity/EntityConditions.java",
    text: "public final class EntityConditions {\n    public static void register() {\n        ConditionTypes.ENTITY.register(Apoli.id(\"sneaking\"), new SneakingCondition());\n    }\n}",
  },
];

// A little of Origins' own data: a power and an origin it ships.
export const DATA = [
  { path: "src/main/resources/data/origins/powers/phantomize.json", text: '{ "type": "apoli:toggle" }' },
  { path: "src/main/resources/data/origins/origins/phantom.json", text: '{ "powers": ["origins:phantomize"], "impact": 3 }' },
  { path: "src/main/resources/data/origins/tags/item/ignore_diet.json", text: '{ "values": [] }' },
];

export function fixtureSchema(): Schema {
  return buildSchema(PAGES, SOURCES, { data: DATA });
}
