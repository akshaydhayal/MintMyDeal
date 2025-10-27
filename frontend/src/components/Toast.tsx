"use client";

import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'loading';

export interface Toast {
	id: string;
	type: ToastType;
	title: string;
	message?: string;
	duration?: number;
	txLink?: string; // Optional Solana Explorer link
}

interface ToastProps {
	toast: Toast;
	onClose: (id: string) => void;
}

function ToastItem({ toast, onClose }: ToastProps) {
	const [isExiting, setIsExiting] = useState(false);

	useEffect(() => {
		if (toast.type === 'loading') return;
		
		const duration = toast.duration || 10000;
		const exitTimer = setTimeout(() => {
			setIsExiting(true);
		}, duration - 300);

		const closeTimer = setTimeout(() => {
			onClose(toast.id);
		}, duration);

		return () => {
			clearTimeout(exitTimer);
			clearTimeout(closeTimer);
		};
	}, [toast, onClose]);

	const getIcon = () => {
		switch (toast.type) {
			case 'success':
				return '✅';
			case 'error':
				return '❌';
			case 'loading':
				return '⏳';
			case 'info':
				return 'ℹ️';
		}
	};

	const getColors = () => {
		switch (toast.type) {
			case 'success':
				return 'border-green-800 bg-green-950/90 text-green-200';
			case 'error':
				return 'border-red-800 bg-red-950/90 text-red-200';
			case 'loading':
				return 'border-blue-800 bg-blue-950/90 text-blue-200';
			case 'info':
				return 'border-neutral-700 bg-neutral-900/90 text-neutral-200';
		}
	};

	return (
		<div
			className={`
				rounded-lg border backdrop-blur-sm shadow-lg p-4 min-w-[320px] max-w-md
				transition-all duration-300 ease-in-out
				${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
				${getColors()}
			`}
		>
			<div className="flex items-start gap-3">
				<div className="text-2xl flex-shrink-0 mt-0.5">
					{getIcon()}
					{toast.type === 'loading' && <span className="animate-pulse">●</span>}
				</div>
				<div className="flex-1 min-w-0">
					<div className="font-medium text-sm">{toast.title}</div>
					{toast.message && (
						<div className="text-xs opacity-80 mt-1 break-words">{toast.message}</div>
					)}
					{toast.txLink && (
						<a
							href={toast.txLink}
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs mt-2 inline-flex items-center gap-1 opacity-90 hover:opacity-100 underline"
						>
							View on Solana Explorer →
						</a>
					)}
				</div>
				{toast.type !== 'loading' && (
					<button
						onClick={() => {
							setIsExiting(true);
							setTimeout(() => onClose(toast.id), 300);
						}}
						className="text-lg opacity-60 hover:opacity-100 flex-shrink-0"
					>
						×
					</button>
				)}
			</div>
		</div>
	);
}

interface ToastContainerProps {
	toasts: Toast[];
	onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
	return (
		<div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
			<div className="pointer-events-auto flex flex-col gap-2">
				{toasts.map(toast => (
					<ToastItem key={toast.id} toast={toast} onClose={onClose} />
				))}
			</div>
		</div>
	);
}

