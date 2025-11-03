'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HelpCircle, ExternalLink } from 'lucide-react';

interface HelpWidgetProps {
  // The page to link to (e.g., /studentfaq or /facultyfaq)
  href: string;
  // A few quick questions to show on hover
  hotFaqs: { q: string }[];
}

export default function HelpWidget({ href, hotFaqs }: HelpWidgetProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="fixed bottom-6 right-6 z-50 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Pop-up Box (visible on hover) */}
      {isHovered && (
        <div className="absolute bottom-full right-0 mb-3 w-72 bg-white border-2 border-gray-300 rounded-xl shadow-lg p-4">
          <h4 className="font-bold text-gray-800 mb-2">Common Questions</h4>
          <ul className="space-y-2 list-disc list-inside">
            {hotFaqs.map((faq, index) => (
              <li key={index} className="text-sm text-gray-600">
                {faq.q}
              </li>
            ))}
          </ul>
          <div className="border-t-2 border-gray-200 mt-3 pt-3">
            <p className="text-xs text-gray-500">
              Click the question mark to open the full FAQ page.
            </p>
          </div>
        </div>
      )}

      {/* Circular Button */}
      <Link
        href={href}
        className="w-14 h-14 bg-red-800 text-white rounded-full flex items-center justify-center shadow-lg transition-transform transform group-hover:scale-110"
      >
        <HelpCircle className="w-8 h-8" />
      </Link>
    </div>
  );
}