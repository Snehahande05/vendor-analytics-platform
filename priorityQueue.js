// Simple Priority Queue using array (higher score = higher priority)
class PriorityQueue {
  constructor() {
    this.items = [];
  }

  enqueue(element, priority) {
    this.items.push({ element, priority });
    // Keep sorted descending by priority
    this.items.sort((a, b) => b.priority - a.priority);
  }

  dequeue() {
    return this.items.shift()?.element;
  }

  size() {
    return this.items.length;
  }
}

module.exports = PriorityQueue;
