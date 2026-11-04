'use client';
// Days-to-go computed in the visitor's browser, so it's right even if the page was built days ago.
import { useEffect, useState } from 'react';

export default function Countdown({ date }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, day] = date.split('-').map(Number);
    setD(Math.round((new Date(y, m - 1, day) - today) / 864e5));
  }, [date]);
  if (d === null) return <span className="count" data-date={date}>&nbsp;</span>;
  if (d < 0) return <span className="count">Out now</span>;
  if (d === 0) return <span className="count">Today</span>;
  return (
    <span className="count">
      {d}
      <small>{d === 1 ? 'day to go' : 'days to go'}</small>
    </span>
  );
}
