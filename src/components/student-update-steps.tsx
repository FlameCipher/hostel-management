export function StudentUpdateSteps({ current }: { current: 1 | 2 | 3 }) {
  return <ol className="student-update-steps" aria-label="Student details update progress">
    {["Find your record", "Complete details", "Office review"].map((label, index) => <li key={label} aria-current={current === index + 1 ? "step" : undefined}><span aria-hidden="true">{index + 1}</span>{label}</li>)}
  </ol>;
}
