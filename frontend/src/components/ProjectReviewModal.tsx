'use client';

import React, { useId, useState } from 'react';
import { ProjectReview } from '@/types';
import { toast } from 'sonner';
import { AccessibleModal } from '@/components/a11y/AccessibleModal';
import { announcePolite } from '@/components/a11y/LiveAnnouncer';

export interface ProjectReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  reviewerAddress: string;
  reviewerRole: 'client' | 'freelancer';
  onSubmitReview?: (review: ProjectReview) => void;
}

const STARS = [1, 2, 3, 4, 5] as const;

function StarRatingGroup({
  label,
  current,
  onChange,
}: {
  label: string;
  current: number;
  onChange: (val: number) => void;
}) {
  const labelId = useId();

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, star: number) => {
    let next = star;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      next = star < 5 ? star + 1 : 1;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      next = star > 1 ? star - 1 : 5;
    } else if (event.key === 'Home') {
      next = 1;
    } else if (event.key === 'End') {
      next = 5;
    } else {
      return;
    }
    event.preventDefault();
    onChange(next);
    const group = event.currentTarget.parentElement;
    const buttons = group?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons?.[next - 1]?.focus();
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
      <span id={labelId} className="text-sm font-medium text-slate-300">{label}</span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex items-center gap-1"
      >
        {STARS.map((star) => {
          const isSelected = star === current;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
              tabIndex={isSelected ? 0 : -1}
              key={star}
              onClick={() => onChange(star)}
              onKeyDown={(e) => handleKeyDown(e, star)}
              className={`text-lg transition transform hover:scale-110 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                star <= current ? 'text-amber-400' : 'text-slate-600'
              }`}
            >
              <span aria-hidden="true">★</span>
            </button>
          );
        })}
        <span className="text-xs font-semibold text-slate-400 ml-2 w-6 text-right" aria-hidden="true">
          {current}.0
        </span>
      </div>
    </div>
  );
}

export function ProjectReviewModal({
  isOpen,
  onClose,
  projectId,
  projectTitle,
  reviewerAddress,
  reviewerRole,
  onSubmitReview,
}: ProjectReviewModalProps) {
  const [commRating, setCommRating] = useState<number>(5);
  const [qualRating, setQualRating] = useState<number>(5);
  const [timeRating, setTimeRating] = useState<number>(5);
  const [testimonial, setTestimonial] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const titleId = useId();
  const testimonialId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testimonial.trim()) {
      toast.error('Please write a brief testimonial (up to 500 characters).');
      return;
    }

    setIsSubmitting(true);
    try {
      const avg = Number(((commRating + qualRating + timeRating) / 3).toFixed(1));
      const review: ProjectReview = {
        id: `rev-${Date.now()}`,
        project_id: projectId,
        reviewer_address: reviewerAddress,
        reviewer_role: reviewerRole,
        communication_rating: commRating,
        quality_rating: qualRating,
        timeliness_rating: timeRating,
        average_rating: avg,
        testimonial: testimonial.trim(),
        created_at: new Date().toISOString(),
      };

      if (onSubmitReview) {
        onSubmitReview(review);
      }

      announcePolite('Review submitted successfully.');
      toast.success('Review submitted successfully! Thank you for your feedback.');
      onClose();
    } catch {
      toast.error('Failed to submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy={titleId}
      backdropClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      dialogClassName="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-200"
    >
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h3 id={titleId} className="text-xl font-bold text-white">Leave Feedback & Review</h3>
          <p className="text-xs text-slate-400 mt-0.5">Project: {projectTitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close review modal"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="space-y-1">
          <StarRatingGroup label="Communication" current={commRating} onChange={setCommRating} />
          <StarRatingGroup label="Quality of Work" current={qualRating} onChange={setQualRating} />
          <StarRatingGroup label="Timeliness" current={timeRating} onChange={setTimeRating} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor={testimonialId} className="text-sm font-medium text-slate-300">
              Written Testimonial
            </label>
            <span className="text-xs text-slate-500" aria-live="polite">
              {testimonial.length}/500
            </span>
          </div>
          <textarea
            id={testimonialId}
            value={testimonial}
            onChange={(e) => setTestimonial(e.target.value.slice(0, 500))}
            rows={4}
            placeholder="Share your experience working on this milestone escrow project..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !testimonial.trim()}
            aria-busy={isSubmitting || undefined}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </form>
    </AccessibleModal>
  );
}
