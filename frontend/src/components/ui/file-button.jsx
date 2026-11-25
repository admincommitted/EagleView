import { useRef } from 'react';
import { Button } from "@/components/ui/button"

function FileButton({ accept, multiple, onFiles, onChange, children, ...buttonProps }) {
  const inputRef = useRef(null)

  const handleChange = (event) => {
    onChange?.(event)
    onFiles?.([...event.target.files])
    event.target.value = ""
  }

  return (
    <>
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} onChange={handleChange} hidden />
      <Button {...buttonProps} onClick={() => inputRef.current.click()}>{children}</Button>
    </>
  )
}

export { FileButton }
