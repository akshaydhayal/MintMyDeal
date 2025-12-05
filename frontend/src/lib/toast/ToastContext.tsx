"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Toast, ToastType, ToastContainer } from '@/components/Toast';

interface ToastContextType {
	showToast: (type: ToastType, title: string, message?: string, duration?: number) => string;
	hideToast: (id: string) => void;
	updateToast: (id: string, updates: Partial<Toast>) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);

	const showToast = useCallback((type: ToastType, title: string, message?: string, duration?: number): string => {
		const id = Math.random().toString(36).substring(7);
		const newToast: Toast = { id, type, title, message, duration };
		setToasts(prev => [...prev, newToast]);
		return id;
	}, []);

	const hideToast = useCallback((id: string) => {
		setToasts(prev => prev.filter(t => t.id !== id));
	}, []);

	const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
		setToasts(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
	}, []);

	return (
		<ToastContext.Provider value={{ showToast, hideToast, updateToast }}>
			{children}
			<ToastContainer toasts={toasts} onClose={hideToast} />
		</ToastContext.Provider>
	);
}

export function useToast() {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error('useToast must be used within ToastProvider');
	}
	return context;
}

