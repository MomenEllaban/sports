'use client';

import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { apiRequest } from '@/lib/client-api';

export interface PublicReview {
  id: string;
  rating: number;
  text: string | null;
  createdAt: string;
}

function Stars({ value, size = 'w-4 h-4' }: { value: number; size?: string }) {
  return (
    <span className="flex gap-0.5" aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${size} ${i <= value ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
      ))}
    </span>
  );
}

export function RatingSummary({ avg, count }: { avg: number; count: number }) {
  if (count === 0) return <span className="text-[11px] text-slate-500">لا تقييمات بعد — كن أول من يقيّم</span>;
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <Stars value={Math.round(avg)} />
      <span className="font-black text-slate-100">{avg.toFixed(1)}</span>
      <span className="text-slate-500">({count})</span>
    </span>
  );
}

export default function ReviewsSection({ productId, reviews, avg, count }: {
  productId: string; reviews: PublicReview[]; avg: number; count: number;
}) {
  const { toast } = useToast();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const data = await apiRequest<{ message?: string }>('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({ productId, rating, text: text || undefined }),
        errorKey: 'storefront:reviews:create',
      });
      toast(data.message || 'تم إرسال تقييمك', 'success');
      setText('');
    } catch {
      toast('تعذر الاتصال', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass-panel rounded-2xl border border-slate-800 p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-black text-lg">تقييمات العملاء</h2>
        <RatingSummary avg={avg} count={count} />
      </div>
      <div className="space-y-2">
        {reviews.length === 0 && <p className="text-xs text-slate-500">لا توجد تقييمات معتمدة بعد.</p>}
        {reviews.slice(0, 5).map((r) => (
          <div key={r.id} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 text-xs">
            <Stars value={r.rating} size="w-3.5 h-3.5" />
            {r.text && <p className="text-slate-300 leading-relaxed">{r.text}</p>}
            <p className="text-[10px] text-slate-500">{new Date(r.createdAt).toLocaleDateString('ar-EG')}</p>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center gap-1" role="radiogroup" aria-label="تقييمك">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={rating === i}
              aria-label={`${i} نجوم`}
              onClick={() => setRating(i)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Star className={`w-6 h-6 ${i <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
            </button>
          ))}
        </div>
        <label htmlFor="review-text" className="sr-only">رأيك في المنتج</label>
        <textarea
          id="review-text"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="رأيك في المنتج (اختياري)..."
          className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs focus:outline-none focus:border-amber-500 resize-none"
        />
        <button type="submit" disabled={busy} className="min-h-[44px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 text-xs font-black">
          {busy ? '...' : 'إرسال التقييم'}
        </button>
      </form>
    </section>
  );
}
