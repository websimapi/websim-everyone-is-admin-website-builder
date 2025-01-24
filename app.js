const { useState, useEffect, useRef } = React;

const App = () => {
  const room = new WebsimSocket();
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mode, setMode] = useState('preview'); // 'preview' or 'code'
  const [showNewPageForm, setShowNewPageForm] = useState(false);
  const editorRef = useRef(null);
  const aceEditorRef = useRef(null);

  // Remove automatic fullscreen request since it requires user interaction
  const requestFullscreen = () => {
    const elem = document.documentElement;
    try {
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
    } catch (error) {
      console.warn('Fullscreen request failed:', error);
    }
  };

  useEffect(() => {
    // Initialize Ace editor
    if (mode === 'code' && !aceEditorRef.current && editorRef.current) {
      try {
        aceEditorRef.current = ace.edit(editorRef.current);
        aceEditorRef.current.setTheme('ace/theme/monokai');
        aceEditorRef.current.session.setMode('ace/mode/html');
        aceEditorRef.current.setOptions({
          fontSize: '14px',
          showPrintMargin: false,
          showGutter: true,
          highlightActiveLine: true,
          wrap: true
        });
      } catch (error) {
        console.error('Error initializing Ace editor:', error);
      }
    }
  }, [mode]);

  // Update editor content when switching modes or pages
  useEffect(() => {
    if (mode === 'code' && currentPage) {
      // Wait for Ace editor to be initialized
      setTimeout(() => {
        if (aceEditorRef.current) {
          aceEditorRef.current.setValue(currentPage.content || '', -1);
          // Ensure editor is properly sized
          aceEditorRef.current.resize();
        }
      }, 100);
    }
  }, [mode, currentPage]);

  // Subscribe to pages collection
  useEffect(() => {
    let unsubscribe;
    try {
      unsubscribe = room.collection('page').subscribe(newPages => {
        setPages(newPages);
      });
    } catch (error) {
      console.error('Error subscribing to pages:', error);
    }
    return () => unsubscribe?.();
  }, []);

  const createPage = async (pageName) => {
    if (!pageName?.trim()) {
      throw new Error('Page name is required');
    }

    const existingPage = pages.find(p => p.name.toLowerCase() === pageName.toLowerCase());
    if (existingPage) {
      throw new Error('Page name already exists');
    }
    
    try {
      const page = await room.collection('page').create({
        name: pageName,
        content: '<h1>Welcome to your new page!</h1>'
      });
      
      setCurrentPage(page);
      setEditorContent(page.content);
      return page;
    } catch (error) {
      console.error('Error creating page:', error);
      throw new Error('Failed to create page. Please try again.');
    }
  };

  const savePage = async () => {
    if (!currentPage) return;
    
    try {
      let contentToSave;
      if (mode === 'code' && aceEditorRef.current) {
        contentToSave = aceEditorRef.current.getValue();
        // Update the preview content as well
        setEditorContent(contentToSave);
      } else {
        contentToSave = editorContent;
      }
        
      await room.collection('page').update(currentPage.id, {
        content: contentToSave
      });
    } catch (error) {
      console.error('Error saving page:', error);
      alert('Failed to save page. Please try again.');
    }
  };

  const handleModeChange = (newMode) => {
    if (newMode === 'preview' && mode === 'code' && aceEditorRef.current) {
      // When switching from code to preview, update the preview content
      setEditorContent(aceEditorRef.current.getValue());
    }
    setMode(newMode);
  };

  const handlePageSelect = (page) => {
    try {
      setCurrentPage(page);
      setEditorContent(page.content);
      if (mode === 'code' && aceEditorRef.current) {
        aceEditorRef.current.setValue(page.content || '', -1);
      }
      setSidebarOpen(false);
    } catch (error) {
      console.error('Error selecting page:', error);
    }
  };

  const NewPageForm = () => {
    const [name, setName] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        await createPage(name);
        setName('');
        setError('');
        setShowNewPageForm(false);
      } catch (err) {
        setError(err.message);
      }
    };

    if (!showNewPageForm) return null;

    return (
      <div style={{ 
        padding: 20, 
        background: 'white', 
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        maxWidth: 400,
        margin: '40px auto'
      }}>
        <h2 style={{ marginBottom: 16 }}>Create New Page</h2>
        <form onSubmit={handleSubmit} className="new-page-form">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter page name"
            className="input"
            autoFocus
          />
          {error && <div className="error">{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="button">
              <i className="fas fa-plus"></i> Create Page
            </button>
            <button 
              type="button" 
              className="button secondary"
              onClick={() => setShowNewPageForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="app">
      <div className="browser-bar">
        <button className="mobile-menu-button" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <i className="fas fa-bars"></i>
        </button>
        <div className="browser-buttons">
          <div className="browser-button close"></div>
          <div className="browser-button minimize"></div>
          <div className="browser-button maximize"></div>
        </div>
        <div className="url-bar">
          <i className="fas fa-lock secure-icon"></i>
          <span className="url-text">
            {currentPage ? `website-builder.app/${currentPage.name}` : 'website-builder.app'}
          </span>
        </div>
        <button 
          className="new-page-button"
          onClick={() => setShowNewPageForm(true)}
        >
          <i className="fas fa-plus"></i> New Page
        </button>
      </div>
      
      <div className="main-content">
        <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <ul className="pages-list">
            {pages.map(page => (
              <li
                key={page.id}
                className={`page-item ${currentPage?.id === page.id ? 'active' : ''}`}
                onClick={() => handlePageSelect(page)}
              >
                <span>{page.name}</span>
                <small>by {page.username}</small>
              </li>
            ))}
          </ul>
        </div>

        <div className="editor-container">
          {showNewPageForm ? (
            <NewPageForm />
          ) : (
            <>
              <div className="editor-toolbar">
                <div className="editor-modes">
                  <button
                    className={`mode-button ${mode === 'preview' ? 'active' : ''}`}
                    onClick={() => handleModeChange('preview')}
                  >
                    Preview
                  </button>
                  <button
                    className={`mode-button ${mode === 'code' ? 'active' : ''}`}
                    onClick={() => handleModeChange('code')}
                  >
                    Code
                  </button>
                </div>
                <button className="button" onClick={savePage}>
                  <i className="fas fa-save"></i> Save
                </button>
              </div>

              {mode === 'preview' && currentPage && (
                <iframe
                  className="preview-iframe"
                  srcDoc={editorContent}
                  title="Preview"
                />
              )}
              
              {mode === 'code' && currentPage && (
                <div ref={editorRef} className="code-editor"></div>
              )}
              
              {!currentPage && !showNewPageForm && (
                <div style={{ padding: 20, textAlign: 'center' }}>
                  Create a new page or select an existing one to begin editing
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);