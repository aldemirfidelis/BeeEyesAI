import BeeEyes from "../BeeEyes";

export default function BeeEyesExample() {
  return (
    <div className="flex flex-col items-center gap-8 p-8">
      <div className="text-center">
        <h3 className="font-display text-xl mb-2">Neutral</h3>
        <BeeEyes expression="neutral" />
      </div>
      <div className="text-center">
        <h3 className="font-display text-xl mb-2">Happy</h3>
        <BeeEyes expression="happy" />
      </div>
      <div className="text-center">
        <h3 className="font-display text-xl mb-2">Celebrating</h3>
        <BeeEyes expression="celebrating" />
      </div>
    </div>
  );
}
