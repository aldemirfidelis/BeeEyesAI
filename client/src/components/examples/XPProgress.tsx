import XPProgress from "../XPProgress";

export default function XPProgressExample() {
  return (
    <div className="max-w-md p-4">
      <XPProgress currentXP={350} level={5} xpToNextLevel={500} />
    </div>
  );
}
