import React, { useState, useEffect, useRef } from 'react';

export default function CharCountTextarea({ maxLength, maxLines, maxCharsPerLine, value, onChange, defaultValue, className, style, ...props }) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(isControlled ? value : (defaultValue || ''));
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isControlled) {
      setInternalValue(value);
    }
  }, [value, isControlled]);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [internalValue]);

  const handleChange = (e) => {
    let newVal = e.target.value;

    if (maxLines || maxCharsPerLine) {
      let lines = newVal.split('\n');
      let modified = false;
      
      const parsedMaxLines = maxLines ? parseInt(maxLines, 10) : null;
      const parsedMaxChars = maxCharsPerLine ? parseInt(maxCharsPerLine, 10) : null;

      if (parsedMaxLines && lines.length > parsedMaxLines) {
        lines = lines.slice(0, parsedMaxLines);
        modified = true;
      }
      
      if (parsedMaxChars) {
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].length > parsedMaxChars) {
            lines[i] = lines[i].substring(0, parsedMaxChars);
            modified = true;
          }
        }
      }
      
      if (modified) {
        newVal = lines.join('\n');
        e.target.value = newVal;
      }
    }

    setInternalValue(newVal);
    if (onChange) {
      onChange(e);
    }
  };

  const parsedMax = maxLength ? parseInt(maxLength, 10) : (maxLines && maxCharsPerLine ? parseInt(maxLines, 10) * parseInt(maxCharsPerLine, 10) : null);
  const currentLength = internalValue ? String(internalValue).length : 0;
  const remaining = parsedMax ? parsedMax - currentLength : null;
  
  let label = remaining !== null ? `${remaining} chars left` : '';
  if (maxLines && maxCharsPerLine) {
    const linesCount = internalValue === '' ? 1 : String(internalValue).split('\n').length;
    label = `${linesCount}/${maxLines} lines | ${remaining} chars left`;
  }

  return (
    <div style={{ position: 'relative', flex: style?.flex, width: style?.width || '100%', display: 'flex', flexDirection: 'column' }}>
      <textarea 
        ref={textareaRef}
        maxLength={parsedMax || undefined} 
        value={internalValue}
        onChange={handleChange}
        className={className}
        {...props} 
        style={{ 
          ...style, 
          flex: 'none', 
          width: '100%', 
          overflow: 'hidden', 
          paddingBottom: label ? '20px' : style?.paddingBottom,
          minHeight: style?.minHeight || style?.height || '72px',
          height: 'auto'
        }}
      />
      {label && (
        <div style={{ 
          position: 'absolute', 
          bottom: '6px', 
          left: '8px', 
          fontSize: '9px', 
          color: remaining < 20 ? '#ef4444' : 'var(--text-muted, var(--text-muted, #64748b))',
          pointerEvents: 'none',
          background: 'transparent',
          padding: '0',
          zIndex: 999
        }}>
          {label}
        </div>
      )}
    </div>
  );
}
