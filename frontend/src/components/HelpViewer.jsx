import React from 'react';
import { X, BookOpen } from 'lucide-react';
import { helpDocs } from '../utils/helpContent';

const HelpViewer = ({ isOpen, onClose, topic }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '60px',
        right: 0,
        width: '420px',
        height: 'calc(100vh - 60px)',
        backgroundColor: '#f4ecd8', // Vintage paper color
        boxShadow: '-10px 0 25px rgba(0, 0, 0, 0.15)',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
        borderLeft: '4px double #4a3b32', // Newspaper margin
        fontFamily: '"Georgia", "Times New Roman", serif',
        textTransform: 'none' // Override global uppercase
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: '24px 24px 16px',
          borderBottom: '2px solid #4a3b32',
          margin: '0 20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BookOpen size={28} color="#4a3b32" />
          <h2 style={{ margin: 0, fontSize: '26px', color: '#2c241b', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
            System Guide
          </h2>
        </div>
        <button
          onClick={onClose}
          style={{
            background: '#4a3b32',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f4ecd8',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <X size={20} strokeWidth={3} />
        </button>
      </div>
      <div
        className="newspaper-content"
        style={{
          padding: '24px 20px',
          overflowY: 'auto',
          flex: 1,
          color: '#2c241b',
          lineHeight: '1.8',
          fontSize: '15px',
          textAlign: 'justify'
        }}
        dangerouslySetInnerHTML={{
          __html: helpDocs[topic] || '<p>No help available for this section.</p>',
        }}
      />
    </div>
  );
};

export default HelpViewer;
