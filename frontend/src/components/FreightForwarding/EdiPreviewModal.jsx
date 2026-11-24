import React from 'react';

const EdiPreviewModal = ({ isOpen, ediString, onClose, onConfirmTransmit, isLoading, type }) => {
    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
            <div style={{ backgroundColor: '#111827', width: '90%', maxWidth: '800px', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: '1px solid #000000' }}>
                
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1f2937' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#eab308' }}></div>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#22c55e' }}></div>
                        <h3 style={{ margin: '0 0 0 10px', color: '#f3f4f6', fontWeight: 'bold', fontSize: '14px', letterSpacing: '1px' }}>
                            TERMINAL PREVIEW: {type} MESSAGE
                        </h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '20px' }}>&times;</button>
                </div>
                
                {/* Body - Terminal Style */}
                <div style={{ padding: '24px', maxHeight: '60vh', overflowY: 'auto', backgroundColor: '#000000' }}>
                    <pre style={{ 
                        color: '#4ade80', // Tailwind green-400
                        fontFamily: '"Courier New", Courier, monospace', 
                        fontSize: '15px',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        margin: 0
                    }}>
                        {ediString || 'Generating standard IATA payload...'}
                    </pre>
                </div>
                
                {/* Footer */}
                <div style={{ padding: '16px 20px', borderTop: '1px solid #374151', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#1f2937' }}>
                    <button onClick={onClose} disabled={isLoading} style={{ padding: '10px 20px', backgroundColor: 'transparent', color: '#d1d5db', border: '1px solid #000000', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                        CANCEL
                    </button>
                    <button onClick={onConfirmTransmit} disabled={isLoading} style={{ padding: '10px 20px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.4)' }}>
                        {isLoading ? 'TRANSMITTING VIA SFTP...' : 'CONFIRM & TRANSMIT TO AIRLINE'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EdiPreviewModal;
