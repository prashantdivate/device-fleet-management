import { useState } from "react";

export default function TaskItem({ task, onToggle, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(task.content);

  const save = () => {
    if (text.trim() && text !== task.content) {
      onSave(text.trim());
    }
    setEditing(false);
  };

  return (
    <li className="task">
      <input type="checkbox" checked={task.completed} onChange={onToggle} />
      {editing ? (
        <>
          <input value={text} onChange={(e) => setText(e.target.value)} />
          <button onClick={save}>Save</button>
          <button onClick={() => { setText(task.content); setEditing(false); }}>Cancel</button>
        </>
      ) : (
        <>
          <span className={task.completed ? "done" : ""}>{task.content}</span>
          <button onClick={() => setEditing(true)}>Edit</button>
          <button onClick={onDelete}>Delete</button>
        </>
      )}
    </li>
  );
}
