"use client";
import { useId, useState, type InputHTMLAttributes } from "react";
import styles from "./password-input.module.css";

export function PasswordInput({ id, className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  return <span className={styles.field}>
    <input {...props} id={inputId} className={`${className} ${styles.input}`} type={visible ? "text" : "password"}/>
    <button className={styles.toggle} type="button" aria-controls={inputId} aria-pressed={visible} aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible(value => !value)}>{visible ? "Hide" : "Show"}</button>
  </span>;
}
