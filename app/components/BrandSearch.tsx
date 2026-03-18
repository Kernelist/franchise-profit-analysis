"use client";

import { useState, useEffect, useRef } from "react";

interface Brand {
  corpNm: string;
  brandNm: string;
  indutyLclasNm: string;
  indutyMlsfcNm: string;
  frcsCnt: number;
  avrgSlsAmt: number;
}

interface Props {
  onSelect: (brand: Brand) => void;
}

export default function BrandSearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/franchise/brands?search=${encodeURIComponent(query)}&numOfRows=50`);
        const data = await res.json();
        setResults(data.items || []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, [query]);

  const handleSelect = (brand: Brand) => {
    setQuery(brand.brandNm);
    setOpen(false);
    onSelect(brand);
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="브랜드명 또는 회사명 검색 (예: 교촌, BBQ, 스타벅스)"
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
        />
        {loading && (
          <div className="absolute right-3 top-3.5 w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
          {results.map((b, i) => (
            <li
              key={i}
              onClick={() => handleSelect(b)}
              className="px-4 py-2.5 hover:bg-gray-700 cursor-pointer border-b border-gray-700 last:border-0"
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-white font-medium text-sm">{b.brandNm}</span>
                  <span className="text-gray-400 text-xs ml-2">({b.corpNm})</span>
                </div>
                <span className="text-xs bg-gray-700 text-blue-300 px-2 py-0.5 rounded">
                  {b.indutyMlsfcNm}
                </span>
              </div>
              {b.frcsCnt > 0 && (
                <div className="text-xs text-gray-500 mt-0.5">가맹점 {b.frcsCnt}개</div>
              )}
            </li>
          ))}
        </ul>
      )}
      {open && results.length === 0 && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-gray-400 text-sm">
          검색 결과가 없습니다.
        </div>
      )}
    </div>
  );
}
