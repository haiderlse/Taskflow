
import React from 'react';

const PlaceholderPage = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="p-8 text-dark-text bg-main-bg h-full">
        <h1 className="text-4xl font-bold mb-6">{title}</h1>
        <div className="bg-card p-8 rounded-lg shadow-sm border border-border-color">
            <p className="text-subtle-text text-lg leading-relaxed">{children}</p>
        </div>
    </div>
);

export default PlaceholderPage;
