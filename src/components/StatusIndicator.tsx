import React, { useState, useEffect } from 'react';

type StatusLevel = 'none' | 'minor' | 'major' | 'critical' | 'loading';

const STATUS_COLORS: Record<StatusLevel, string> = {
  none: 'bg-[#1eb182]',
  minor: 'bg-yellow-400',
  major: 'bg-orange-500',
  critical: 'bg-red-500',
  loading: 'bg-gray-300',
};

const STATUS_LABELS: Record<StatusLevel, string> = {
  none: 'All systems operational',
  minor: 'Minor issues',
  major: 'Major outage',
  critical: 'Critical outage',
  loading: 'Checking status…',
};

export const StatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<StatusLevel>('loading');

  useEffect(() => {
    fetch('https://hopsworks.statuspage.io/api/v2/status.json')
      .then((res) => res.json())
      .then((data) => {
        const indicator = data?.status?.indicator;
        if (indicator === 'none' || indicator === 'minor' || indicator === 'major' || indicator === 'critical') {
          setStatus(indicator);
        } else {
          setStatus('none');
        }
      })
      .catch(() => {
        // If we can't reach statuspage, don't show a scary color
        setStatus('loading');
      });
  }, []);

  return (
    <a
      href="https://hopsworks.statuspage.io/"
      target="_blank"
      rel="noopener noreferrer"
      title={STATUS_LABELS[status]}
      className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-xs text-green-700 hover:bg-green-100 transition-colors"
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_COLORS[status]}`} />
      Status
    </a>
  );
};
