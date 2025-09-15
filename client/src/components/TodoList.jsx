import { useEffect, useState } from "react";
import api from "../api.js";
import TaskItem from "./TaskItem.jsx";

export default function TodoList() {
  const [tasks, setTasks] = useState([]);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const { data } = await api.get("/tasks");
      setTasks(data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load tasks");
    }
  };

  useEffect(() => { load(); }, []);

  const addTask = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      const { data } = await api.post("/tasks", { content });
      setTasks((prev) => [data, ...prev]);
      setContent("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add task");
    }
  };

  const updateTask = async (id, patch) => {
    try {
      const { data } = await api.put(`/tasks/${id}`, patch);
      setTasks((prev) => prev.map((t) => (t._id === id ? data : t)));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update task");
    }
  };

  const deleteTask = async (id) => {
    try {
      await api.delete(`/tasks/${id}`);
      setTasks((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete task");
    }
  };

  return (
    <div className="card">
      <h2>Your To‑Do List</h2>
      {error && <p className="error">{error}</p>}
      <form onSubmit={addTask} className="row">
        <input
          placeholder="Add a task..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>

      <ul className="list">
        {tasks.map((task) => (
          <TaskItem
            key={task._id}
            task={task}
            onToggle={() => updateTask(task._id, { completed: !task.completed })}
            onSave={(newContent) => updateTask(task._id, { content: newContent })}
            onDelete={() => deleteTask(task._id)}
          />
        ))}
      </ul>
    </div>
  );
}
