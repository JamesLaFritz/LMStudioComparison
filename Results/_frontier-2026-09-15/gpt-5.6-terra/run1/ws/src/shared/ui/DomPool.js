export class DomPool {
  constructor(parent, className, capacity, tagName = 'div') {
    this.parent = parent;
    this.items = new Array(capacity);
    this.free = new Int32Array(capacity);
    this.freeCount = capacity;

    for (let index = 0; index < capacity; index += 1) {
      const element = document.createElement(tagName);
      element.className = className;
      element.hidden = true;
      parent.appendChild(element);
      element.__poolIndex = index;
      element.__poolActive = false;
      this.items[index] = element;
      this.free[index] = capacity - index - 1;
    }
  }

  acquire() {
    if (this.freeCount === 0) {
      return null;
    }
    const item = this.items[this.free[--this.freeCount]];
    item.__poolActive = true;
    item.hidden = false;
    return item;
  }

  release(item) {
    if (!item || !item.__poolActive) {
      return;
    }
    item.__poolActive = false;
    item.hidden = true;
    item.textContent = '';
    item.removeAttribute('style');
    this.free[this.freeCount++] = item.__poolIndex;
  }

  dispose() {
    for (const item of this.items) {
      item.remove();
    }
    this.freeCount = 0;
  }
}
