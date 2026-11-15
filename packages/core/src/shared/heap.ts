/** Minimal binary min-heap with stable ordering for equal priorities. */
export class MinHeap<T> {
  private items: { priority: number; seq: number; value: T }[] = [];
  private seq = 0;

  get size(): number {
    return this.items.length;
  }

  push(priority: number, value: T): void {
    this.items.push({ priority, seq: this.seq++, value });
    this.up(this.items.length - 1);
  }

  peekPriority(): number | undefined {
    return this.items[0]?.priority;
  }

  pop(): { priority: number; value: T } | undefined {
    const top = this.items[0];
    if (!top) return undefined;
    const last = this.items.pop() as (typeof this.items)[number];
    if (this.items.length > 0) {
      this.items[0] = last;
      this.down(0);
    }
    return { priority: top.priority, value: top.value };
  }

  private less(a: number, b: number): boolean {
    const x = this.items[a] as (typeof this.items)[number];
    const y = this.items[b] as (typeof this.items)[number];
    return x.priority < y.priority || (x.priority === y.priority && x.seq < y.seq);
  }

  private swap(a: number, b: number): void {
    const t = this.items[a] as (typeof this.items)[number];
    this.items[a] = this.items[b] as (typeof this.items)[number];
    this.items[b] = t;
  }

  private up(i: number): void {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }

  private down(i: number): void {
    const n = this.items.length;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < n && this.less(l, m)) m = l;
      if (r < n && this.less(r, m)) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
  }
}
