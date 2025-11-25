import React, { useState, useEffect } from 'react';
import { differenceInSeconds } from 'date-fns';

interface TimerProps {
  startTime: string;
}

const Timer: React.FC<TimerProps> = ({ startTime }) => {
  const [elapsed, setElapsed] = useState<string>("00:00:00");

  useEffect(() => {
    const start = new Date(startTime);
    
    const tick = () => {
      const now = new Date();
      const diffSecs = differenceInSeconds(now, start);
      
      const hours = Math.floor(diffSecs / 3600);
      const minutes = Math.floor((diffSecs % 3600) / 60);
      const seconds = diffSecs % 60;

      const pad = (n: number) => n.toString().padStart(2, '0');
      setElapsed(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    };

    tick(); // Initial call
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="font-mono text-xl font-bold text-gray-800">
      Working for {elapsed}
    </div>
  );
};

export default Timer;
