
import React from 'react';
import { XIcon, PlusIcon } from './icons';

interface CreateModalProps {
    onClose: () => void;
}

const CreateModal: React.FC<CreateModalProps> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-dark-text">Create</h2>
                    <button onClick={onClose} className="text-subtle-text hover:text-dark-text">
                        <XIcon />
                    </button>
                </div>
                <p className="text-subtle-text mb-6">What would you like to create today?</p>
                <div className="space-y-3">
                    <button className="w-full text-left p-3 rounded-md hover:bg-gray-100 flex items-center space-x-3">
                        <PlusIcon className="w-5 h-5 text-primary" />
                        <span className="font-medium text-dark-text">Task</span>
                    </button>
                    <button className="w-full text-left p-3 rounded-md hover:bg-gray-100 flex items-center space-x-3">
                        <PlusIcon className="w-5 h-5 text-accent-green" />
                        <span className="font-medium text-dark-text">Project</span>
                    </button>
                    <button className="w-full text-left p-3 rounded-md hover:bg-gray-100 flex items-center space-x-3">
                        <PlusIcon className="w-5 h-5 text-accent-pink" />
                        <span className="font-medium text-dark-text">Goal</span>
                    </button>
                    <button className="w-full text-left p-3 rounded-md hover:bg-gray-100 flex items-center space-x-3">
                        <PlusIcon className="w-5 h-5 text-gray-500" />
                        <span className="font-medium text-dark-text">Team</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateModal;
