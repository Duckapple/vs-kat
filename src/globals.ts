class Reactive<T> {
  #value: T;
  constructor(def: T) {
    this.#value = def;
  }
  get value() {
    return this.#value;
  }
  set value(v: T) {
    this.#value = v;
  }
}

export const workspacePath = new Reactive("");
