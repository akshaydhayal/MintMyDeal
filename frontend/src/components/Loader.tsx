import React from 'react';

interface LoaderProps {
	size?: 'sm' | 'md' | 'lg' | 'xl';
	variant?: 'spinner' | 'dots' | 'pulse';
	text?: string;
	fullScreen?: boolean;
}

export function Loader({ size = 'md', variant = 'spinner', text, fullScreen = false }: LoaderProps) {
	const sizeClasses = {
		sm: 'w-4 h-4',
		md: 'w-8 h-8',
		lg: 'w-12 h-12',
		xl: 'w-16 h-16',
	};

	const spinnerContent = (
		<div className="flex flex-col items-center justify-center gap-3">
			<div className={`${sizeClasses[size]} relative`}>
				<div className="absolute inset-0 rounded-full border-4 border-purple-900/30"></div>
				<div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
			</div>
			{text && (
				<div className="text-sm text-neutral-400 animate-pulse">{text}</div>
			)}
		</div>
	);

	const dotsContent = (
		<div className="flex flex-col items-center justify-center gap-3">
			<div className="flex gap-2">
				<div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
				<div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
				<div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
			</div>
			{text && (
				<div className="text-sm text-neutral-400 animate-pulse">{text}</div>
			)}
		</div>
	);

	const pulseContent = (
		<div className="flex flex-col items-center justify-center gap-3">
			<div className={`${sizeClasses[size]} relative`}>
				<div className="absolute inset-0 rounded-full bg-purple-500 animate-ping opacity-75"></div>
				<div className="absolute inset-0 rounded-full bg-purple-600"></div>
			</div>
			{text && (
				<div className="text-sm text-neutral-400 animate-pulse">{text}</div>
			)}
		</div>
	);

	const content = variant === 'spinner' ? spinnerContent : variant === 'dots' ? dotsContent : pulseContent;

	if (fullScreen) {
		return (
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
				<div className="rounded-lg bg-neutral-900 border border-purple-800/50 p-8 shadow-2xl">
					{content}
				</div>
			</div>
		);
	}

	return content;
}

// Skeleton loader for content placeholders
interface SkeletonProps {
	className?: string;
	count?: number;
}

export function Skeleton({ className = '', count = 1 }: SkeletonProps) {
	return (
		<>
			{Array.from({ length: count }).map((_, i) => (
				<div
					key={i}
					className={`bg-neutral-800 rounded animate-pulse ${className}`}
				/>
			))}
		</>
	);
}

// Card skeleton for deal cards
export function DealCardSkeleton() {
	return (
		<div className="rounded-lg border border-neutral-800 overflow-hidden animate-pulse">
			<div className="aspect-video w-full bg-neutral-800"></div>
			<div className="p-4 space-y-3">
				<div className="flex items-start justify-between">
					<div className="flex-1 space-y-2">
						<div className="h-5 bg-neutral-800 rounded w-3/4"></div>
						<div className="h-3 bg-neutral-800 rounded w-1/2"></div>
					</div>
					<div className="h-6 w-16 bg-neutral-800 rounded-full ml-2"></div>
				</div>
				<div className="h-4 bg-neutral-800 rounded w-full"></div>
				<div className="h-4 bg-neutral-800 rounded w-5/6"></div>
				<div className="space-y-1">
					<div className="flex justify-between">
						<div className="h-3 bg-neutral-800 rounded w-16"></div>
						<div className="h-3 bg-neutral-800 rounded w-16"></div>
					</div>
					<div className="h-2 bg-neutral-800 rounded-full w-full"></div>
				</div>
				<div className="h-3 bg-neutral-800 rounded w-32"></div>
			</div>
		</div>
	);
}

// NFT Card skeleton for redeem page
export function NFTCardSkeleton() {
	return (
		<div className="rounded-lg border border-neutral-800 overflow-hidden animate-pulse">
			<div className="aspect-square w-full bg-neutral-800"></div>
			<div className="p-4 space-y-3">
				<div className="h-5 bg-neutral-800 rounded w-3/4"></div>
				<div className="h-4 bg-neutral-800 rounded w-full"></div>
				<div className="h-10 bg-neutral-800 rounded"></div>
			</div>
		</div>
	);
}

