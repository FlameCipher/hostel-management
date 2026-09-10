"use client";

import { useId } from "react";

type Greeting = "Good morning" | "Good afternoon" | "Good evening";

function greetingForHour(hour: number): Greeting {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function DynamicGreeting({
  firstName,
  initialGreeting,
}: {
  firstName: string;
  initialGreeting: Greeting;
}) {
  const id = useId();
  const greeting = typeof window === "undefined"
    ? initialGreeting
    : greetingForHour(new Date().getHours());
  const serializedId = JSON.stringify(id);
  const serializedName = JSON.stringify(firstName).replaceAll("<", "\\u003c");

  return (
    <>
      <h1 id={id} suppressHydrationWarning>{greeting}, {firstName}</h1>
      <script
        type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: `{var n=document.getElementById(${serializedId});if(n){var h=new Date().getHours();var g=h<12?"Good morning":h<18?"Good afternoon":"Good evening";n.textContent=g+", "+${serializedName}}}`,
        }}
      />
    </>
  );
}
