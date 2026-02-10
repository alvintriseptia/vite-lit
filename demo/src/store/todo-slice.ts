import type { StateCreator } from 'zustand';

export interface Todo {
  id: number;
  text: string;
  done: boolean;
}

export interface TodoSlice {
  todos: Todo[];
  nextId: number;
  addTodo: (text: string) => void;
  toggleTodo: (id: number) => void;
  removeTodo: (id: number) => void;
}

export const createTodoSlice: StateCreator<TodoSlice> = (set) => ({
  todos: [],
  nextId: 1,
  addTodo: (text: string) =>
    set((state) => ({
      todos: [...state.todos, { id: state.nextId, text, done: false }],
      nextId: state.nextId + 1,
    })),
  toggleTodo: (id: number) =>
    set((state) => ({
      todos: state.todos.map((t) =>
        t.id === id ? { ...t, done: !t.done } : t
      ),
    })),
  removeTodo: (id: number) =>
    set((state) => ({
      todos: state.todos.filter((t) => t.id !== id),
    })),
});
