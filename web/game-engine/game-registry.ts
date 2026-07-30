import type {
  GameCatalogEntry,
  GameSnapshot,
  PlayableGameDefinition,
  RuntimeMiniGame,
} from "./game-definition";

type StoredDefinition = PlayableGameDefinition<GameSnapshot, RuntimeMiniGame>;

export class GameRegistry {
  private readonly catalog = new Map<string, GameCatalogEntry>();
  private readonly definitions = new Map<string, StoredDefinition>();

  register<TSnapshot extends GameSnapshot, TGame extends RuntimeMiniGame>(
    definition: PlayableGameDefinition<TSnapshot, TGame>,
  ) {
    this.catalog.set(definition.catalog.id, definition.catalog);
    this.definitions.set(definition.catalog.id, definition as unknown as StoredDefinition);
    return this;
  }

  registerUpcoming(entry: GameCatalogEntry & { availability: "soon" }) {
    this.catalog.set(entry.id, entry);
    return this;
  }

  list(subject?: GameCatalogEntry["subject"]) {
    const entries = [...this.catalog.values()];
    return subject ? entries.filter((entry) => entry.subject === subject) : entries;
  }

  get<TSnapshot extends GameSnapshot, TGame extends RuntimeMiniGame>(id: string) {
    return this.definitions.get(id) as PlayableGameDefinition<TSnapshot, TGame> | undefined;
  }
}
