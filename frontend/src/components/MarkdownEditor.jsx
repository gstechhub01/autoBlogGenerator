import React, { useState } from 'react';
import MDEditor from '@uiw/react-md-editor';

const MarkdownEditor = ({ value = '', onChange }) => {
  const [markdown, setMarkdown] = useState(value);

  const handleChange = (val) => {
    setMarkdown(val);
    if (onChange) onChange(val);
  };

  return (
    <div data-color-mode="light">
      <MDEditor value={markdown} onChange={handleChange} height={400} />
    </div>
  );
};

export default MarkdownEditor;
