
import React, { useMemo } from 'react';
import { isSymbol, GameStatus } from '../types';

interface ArticleRendererProps {
  text: string;
  guessedChars: Set<string>;
  status: GameStatus;
  isTitle?: boolean;
}

const ArticleRenderer: React.FC<ArticleRendererProps> = ({ 
  text, 
  guessedChars, 
  status,
  isTitle = false 
}) => {
  
  // Split text into lines for paragraphs
  const lines = useMemo(() => text.split('\n'), [text]);

  return (
    <div className={`space-y-2 ${isTitle ? 'mb-4 text-center' : ''}`}>
      {lines.map((line, lineIndex) => (
        <div key={lineIndex} className={`flex flex-wrap gap-0.5 ${isTitle ? 'justify-center' : 'justify-start leading-tight'}`}>
          {line.split('').map((char, charIndex) => {
            const charLower = char.toLowerCase();
            const isPunctuation = isSymbol(char);
            // Check lowercase against guessed set
            const isGuessed = guessedChars.has(charLower);
            const isRevealed = isGuessed || isPunctuation || status !== GameStatus.PLAYING;
            const isSpace = char === ' ';

            if (isSpace) {
               return <span key={charIndex} className={`${isTitle ? 'w-2 md:w-4' : 'w-1 md:w-2'} inline-block`}></span>;
            }

            // Style determination
            let tileStyle = "";
            let textStyle = "";

            if (isPunctuation) {
                // Punctuation is just text, no box
                return (
                    <span key={`${lineIndex}-${charIndex}`} className={`flex items-end pb-0.5 ${isTitle ? 'text-xl md:text-2xl' : 'text-sm md:text-lg text-gray-700'}`}>
                        {char}
                    </span>
                );
            }

            if (!isRevealed) {
                // Hidden State (Black/Dark Box)
                // Text is NOT rendered in DOM, so styling handles the box only.
                tileStyle = "bg-gray-900 border-gray-900 shadow-sm";
                textStyle = ""; 
            } else {
                // Revealed State (Tile look)
                if (isGuessed && status === GameStatus.PLAYING) {
                     // Specifically guessed by user
                     tileStyle = "bg-green-50 border-green-400 shadow-md transform scale-105";
                     textStyle = "text-green-700 font-bold";
                } else if (status !== GameStatus.PLAYING && !isGuessed) {
                     // Revealed because game over (Show Answer)
                     tileStyle = "bg-red-50 border-red-200";
                     textStyle = "text-red-700 font-medium";
                } else {
                     // Already guessed or revealed naturally
                     tileStyle = "bg-white border-gray-300 shadow-sm";
                     textStyle = "text-gray-900 font-medium";
                }
            }

            return (
              <span
                key={`${lineIndex}-${charIndex}`}
                className={`
                  transition-all duration-300 ease-out 
                  inline-flex items-center justify-center rounded border
                  select-none
                  ${isTitle ? 'w-8 h-8 md:w-10 md:h-10 text-xl md:text-2xl mb-1' : 'w-5 h-5 md:w-7 md:h-7 text-xs md:text-base mb-0.5'}
                  ${tileStyle}
                  ${textStyle}
                `}
              >
                {/* Security: Only render the character if it is revealed. Otherwise render null. */}
                {isRevealed ? char : null}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default ArticleRenderer;
