import React, { useState, useEffect, useRef } from 'react';

export default function FWBTextArea({ maxLines = 3, maxCharsPerLine = 65, totalMaxChars, value, ...props }) {
  const [val, setVal] = useState(value || '');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (value !== undefined && value !== val) {
      setVal(value);
      if (textareaRef.current && textareaRef.current.value !== value) {
        textareaRef.current.value = value;
      }
    }
  }, [value]);

  const handleChange = (e) => {
    let text = (e.target.value || '').toUpperCase().replace(/[^A-Z0-9\s.,\-\/]/g, '');
    let manualLines = text.split('\n');
    let newLines = [];
    
    for (let i = 0; i < manualLines.length; i++) {
        let l = manualLines[i];
        if (l.length > maxCharsPerLine) {
            let current = l;
            while (current.length > maxCharsPerLine) {
                newLines.push(current.substring(0, maxCharsPerLine));
                current = current.substring(maxCharsPerLine);
            }
            if (current.length > 0) {
                newLines.push(current);
            }
        } else {
            newLines.push(l);
        }
    }
    
    if (totalMaxChars) {
      let currentLen = 0;
      let truncatedLines = [];
      for (let l of newLines) {
        if (currentLen + l.length <= totalMaxChars) {
          truncatedLines.push(l);
          currentLen += l.length + 1;
        } else {
          let remaining = totalMaxChars - currentLen;
          if (remaining > 0) {
            truncatedLines.push(l.substring(0, remaining));
          }
          break;
        }
      }
      newLines = truncatedLines;
    }

    if (newLines.length > maxLines) {
        newLines = newLines.slice(0, maxLines);
    }
    
    const finalVal = newLines.join('\n');
    
    setVal(finalVal);
    
    if (textareaRef.current && textareaRef.current.value !== finalVal) {
      textareaRef.current.value = finalVal;
    }
    
        if (props.onChange) {
      props.onChange({
        target: {
          value: finalVal,
          name: props.name
        },
        preventDefault: e.preventDefault ? () => e.preventDefault() : () => {},
        stopPropagation: e.stopPropagation ? () => e.stopPropagation() : () => {}
      });
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', marginBottom: '14px' }}>
      <textarea 
        {...props} 
        ref={textareaRef}
        value={val} 
        onChange={handleChange} 
        wrap="off" 
        style={{
           ...props.style,
           whiteSpace: 'pre-wrap',
           overflowX: 'hidden'
        }}
        maxLength={totalMaxChars || (maxLines * maxCharsPerLine + (maxLines - 1))}
      />
      <div style={{ position: 'absolute', bottom: '-15px', right: '0', fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 'bold' }}>
        {totalMaxChars ? `${val.length}/${totalMaxChars} Chars (Max ${maxLines} lines)` : `${val === '' ? 0 : val.split('\n').length}/${maxLines} lines (Max ${maxCharsPerLine} chars/line)`}
      </div>
    </div>
  );
}
