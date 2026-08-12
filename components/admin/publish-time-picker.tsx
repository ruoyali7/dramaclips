const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));

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
      <option value="00">00</option>
      <option value="30">30</option>
    </select>
  </div>;
}
