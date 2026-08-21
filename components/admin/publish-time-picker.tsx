const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const minutes = ["00", "10", "20", "30", "40", "50"];

export function defaultPublishTime() {
  const now = new Date();
  now.setSeconds(0, 0);
  now.setMinutes(Math.ceil(now.getMinutes() / 10) * 10);
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `${date}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function PublishTimePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [date = "", time = "00:00"] = value.split("T");
  const [hour = "00", minute = "00"] = time.split(":");
  const updateDate = (nextDate: string) => onChange(nextDate ? `${nextDate}T${hour}:${minute}` : "");
  const updateTime = (nextHour: string, nextMinute: string) => {
    if (date) onChange(`${date}T${nextHour}:${nextMinute}`);
  };

  return <div className="publish-time-picker">
    <input aria-label="Publish date" type="date" value={date} onChange={(event) => updateDate(event.target.value)} />
    <select aria-label="Publish hour" value={hour} onChange={(event) => updateTime(event.target.value, minute)} disabled={!date}>
      {hours.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
    <select aria-label="Publish minute" value={minute} onChange={(event) => updateTime(hour, event.target.value)} disabled={!date}>
      {minutes.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </div>;
}
