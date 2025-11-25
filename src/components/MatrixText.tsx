import React from 'react';

interface MatrixTextProps {
  text: string;
}

export const MatrixText: React.FC<MatrixTextProps> = ({ text }) => {
  return (
    <span className="font-mono font-bold relative inline-block">
      {text.split('').map((char, index) => (
        <span
          key={index}
          className="relative inline-block animate-matrix-char"
          style={{
            animationDelay: `${index * 0.2}s`,
          }}
        >
          {char}
        </span>
      ))}
    </span>
  );
};
