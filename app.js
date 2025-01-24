const { useState, useEffect, useRef } = React;

const App = () => {
  const room = new WebsimSocket();
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mode, setMode] = useState('preview'); // 'preview' or 'code'
  const [showNewPageForm, setShowNewPageForm] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const editorRef = useRef(null);
  const aceEditorRef = useRef(null);
  const sidebarRef = useRef(null);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    
    if (isLeftSwipe) {
      setSidebarOpen(false);
    }
  };

  // Initialize or destroy Ace editor based on mode
  useEffect(() => {
    if (mode === 'code') {
      if (!aceEditorRef.current && editorRef.current) {
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
          
          // Set initial content if available
          if (currentPage?.content) {
            aceEditorRef.current.setValue(currentPage.content, -1);
          }
          
          // Ensure editor is properly sized
          aceEditorRef.current.resize();
        } catch (error) {
          console.error('Error initializing Ace editor:', error);
        }
      }
    } else {
      // Cleanup editor when switching away from code mode
      if (aceEditorRef.current) {
        aceEditorRef.current.destroy();
        aceEditorRef.current.container.remove();
        aceEditorRef.current = null;
      }
    }

    // Cleanup on component unmount
    return () => {
      if (aceEditorRef.current) {
        aceEditorRef.current.destroy();
        aceEditorRef.current = null;
      }
    };
  }, [mode]);

  // Update editor content when switching pages
  useEffect(() => {
    if (currentPage) {
      setEditorContent(currentPage.content || '');
      if (mode === 'code' && aceEditorRef.current) {
        aceEditorRef.current.setValue(currentPage.content || '', -1);
        aceEditorRef.current.resize();
      }
    }
  }, [currentPage]);

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
      } else {
        contentToSave = editorContent;
      }
      
      await room.collection('page').update(currentPage.id, {
        content: contentToSave
      });
      
      // Update the preview content after successful save
      setEditorContent(contentToSave);
    } catch (error) {
      console.error('Error saving page:', error);
      alert('Failed to save page. Please try again.');
    }
  };

  const handleModeChange = (newMode) => {
    if (newMode === mode) return; // Prevent unnecessary mode changes
    
    if (newMode === 'preview' && aceEditorRef.current) {
      // When switching to preview, update the preview content
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

  const deletePage = async (pageId, event) => {
    event.stopPropagation(); // Prevent triggering page selection
    if (!pageId) return;
    
    try {
      await room.collection('page').delete(pageId);
      
      // If we deleted the current page, clear the current page state
      if (currentPage?.id === pageId) {
        setCurrentPage(null);
        setEditorContent('');
        if (aceEditorRef.current) {
          aceEditorRef.current.setValue('', -1);
        }
      }
    } catch (error) {
      console.error('Error deleting page:', error);
      alert('Failed to delete page. Please try again.');
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
        <div 
          className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} 
          onClick={() => setSidebarOpen(false)}
        ></div>
        <div 
          ref={sidebarRef}
          className={`sidebar ${sidebarOpen ? 'open' : ''}`}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <button 
            className="back-button" 
            onClick={() => setSidebarOpen(false)}
          >
            <i className="fas fa-times"></i>
          </button>
          <ul className="pages-list">
            {pages.map(page => (
              <li
                key={page.id}
                className={`page-item ${currentPage?.id === page.id ? 'active' : ''}`}
                onClick={() => handlePageSelect(page)}
              >
                <div className="page-item-content">
                  <span>{page.name}</span>
                  <small>by {page.username}</small>
                </div>
                <button 
                  className="delete-button"
                  onClick={(e) => deletePage(page.id, e)}
                  title="Delete page"
                >
                  <i className="fas fa-trash"></i>
                </button>
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
                <div 
                  ref={editorRef} 
                  className="code-editor"
                  key={`editor-${currentPage.id}`}
                ></div>
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