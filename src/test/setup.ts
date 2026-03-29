import { beforeEach } from "vitest";

const createMemoryStorage = () => {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
};

if (typeof window !== "undefined" && typeof window.localStorage?.setItem !== "function") {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: createMemoryStorage(),
  });
}

beforeEach(() => {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  const storage = window.localStorage as {
    removeItem?: (key: string) => void;
  };

  storage.removeItem?.("bbodong.home-state.v2");
});
