/**
 * BeyondAsk Widget - Simple Debug Version
 */
(function() {
  console.log('BeyondAsk Widget: Script loaded');
  
  class SimpleWidget {
    constructor() {
      this.isOpen = false;
      this.container = null;
      this.button = null;
      this.chatContainer = null;
    }
    
    init() {
      try {
        console.log('BeyondAsk Widget: Creating widget elements');
        
        // Create widget container
        this.container = document.createElement('div');
        this.container.id = 'beyond-widget-container';
        this.container.style.position = 'fixed';
        this.container.style.bottom = '20px';
        this.container.style.right = '20px';
        this.container.style.zIndex = '999999';
        
        // Create button
        this.button = document.createElement('div');
        this.button.id = 'beyond-widget-button';
        this.button.style.width = '60px';
        this.button.style.height = '60px';
        this.button.style.borderRadius = '50%';
        this.button.style.backgroundColor = '#ff0000'; // Bright red for visibility
        this.button.style.display = 'flex';
        this.button.style.alignItems = 'center';
        this.button.style.justifyContent = 'center';
        this.button.style.cursor = 'pointer';
        this.button.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.2)';
        this.button.style.color = 'white';
        this.button.style.fontSize = '24px';
        
        // Add message icon
        this.button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
        
        // Create chat container (initially hidden)
        this.chatContainer = document.createElement('div');
        this.chatContainer.id = 'beyond-chat-container';
        this.chatContainer.style.position = 'absolute';
        this.chatContainer.style.bottom = '80px';
        this.chatContainer.style.right = '0';
        this.chatContainer.style.width = '350px';
        this.chatContainer.style.height = '450px';
        this.chatContainer.style.backgroundColor = '#ffffff';
        this.chatContainer.style.borderRadius = '10px';
        this.chatContainer.style.boxShadow = '0 5px 25px rgba(0, 0, 0, 0.2)';
        this.chatContainer.style.display = 'none';
        this.chatContainer.style.flexDirection = 'column';
        this.chatContainer.style.overflow = 'hidden';
        this.chatContainer.style.transition = 'all 0.3s ease';
        
        // Chat header
        const header = document.createElement('div');
        header.style.padding = '15px';
        header.style.backgroundColor = '#ff0000';
        header.style.color = 'white';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        
        const headerTitle = document.createElement('div');
        headerTitle.innerHTML = '<h3 style="margin:0;font-size:16px;font-weight:600;">BeyondAsk Widget</h3>';
        
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '&times;';
        closeButton.style.background = 'none';
        closeButton.style.border = 'none';
        closeButton.style.color = 'white';
        closeButton.style.fontSize = '20px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.padding = '0';
        closeButton.style.width = '24px';
        closeButton.style.height = '24px';
        closeButton.style.display = 'flex';
        closeButton.style.alignItems = 'center';
        closeButton.style.justifyContent = 'center';
        
        header.appendChild(headerTitle);
        header.appendChild(closeButton);
        
        // Chat messages area
        const messagesContainer = document.createElement('div');
        messagesContainer.style.flex = '1';
        messagesContainer.style.overflow = 'auto';
        messagesContainer.style.padding = '15px';
        
        // Add welcome message
        const welcomeMessage = document.createElement('div');
        welcomeMessage.style.maxWidth = '80%';
        welcomeMessage.style.padding = '10px 12px';
        welcomeMessage.style.borderRadius = '12px';
        welcomeMessage.style.backgroundColor = '#f1f1f1';
        welcomeMessage.style.marginBottom = '10px';
        welcomeMessage.style.alignSelf = 'flex-start';
        welcomeMessage.innerHTML = '<p style="margin:0;">Hello! This is a test of the BeyondAsk widget. How can I help you today?</p>';
        messagesContainer.appendChild(welcomeMessage);
        
        // Input area
        const inputArea = document.createElement('div');
        inputArea.style.padding = '10px';
        inputArea.style.borderTop = '1px solid #e1e1e1';
        inputArea.style.display = 'flex';
        inputArea.style.gap = '10px';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Type your message...';
        input.style.flex = '1';
        input.style.padding = '10px';
        input.style.border = '1px solid #ddd';
        input.style.borderRadius = '4px';
        
        const sendButton = document.createElement('button');
        sendButton.innerText = 'Send';
        sendButton.style.padding = '10px 15px';
        sendButton.style.backgroundColor = '#ff0000';
        sendButton.style.color = 'white';
        sendButton.style.border = 'none';
        sendButton.style.borderRadius = '4px';
        sendButton.style.cursor = 'pointer';
        
        inputArea.appendChild(input);
        inputArea.appendChild(sendButton);
        
        // Assemble chat container
        this.chatContainer.appendChild(header);
        this.chatContainer.appendChild(messagesContainer);
        this.chatContainer.appendChild(inputArea);
        
        // Add event listeners
        this.button.addEventListener('click', () => this.toggleChat());
        closeButton.addEventListener('click', () => this.toggleChat(false));
        
        sendButton.addEventListener('click', () => {
          if (input.value.trim()) {
            // Create user message element
            const userMessage = document.createElement('div');
            userMessage.style.maxWidth = '80%';
            userMessage.style.padding = '10px 12px';
            userMessage.style.borderRadius = '12px';
            userMessage.style.backgroundColor = '#ff0000';
            userMessage.style.color = 'white';
            userMessage.style.marginBottom = '10px';
            userMessage.style.marginLeft = 'auto'; // Right align
            userMessage.innerHTML = `<p style="margin:0;">${input.value}</p>`;
            messagesContainer.appendChild(userMessage);
            
            // Clear input
            const userInput = input.value;
            input.value = '';
            
            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            // Simulate response after a delay
            setTimeout(() => {
              const botMessage = document.createElement('div');
              botMessage.style.maxWidth = '80%';
              botMessage.style.padding = '10px 12px';
              botMessage.style.borderRadius = '12px';
              botMessage.style.backgroundColor = '#f1f1f1';
              botMessage.style.marginBottom = '10px';
              botMessage.innerHTML = '<p style="margin:0;">Thank you for your message! This is a simulated response from the BeyondAsk widget.</p>';
              messagesContainer.appendChild(botMessage);
              
              // Scroll to bottom again
              messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 1000);
          }
        });
        
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && input.value.trim()) {
            sendButton.click();
          }
        });
        
        // Add to container and then to document
        this.container.appendChild(this.button);
        this.container.appendChild(this.chatContainer);
        document.body.appendChild(this.container);
        
        console.log('BeyondAsk Widget: Widget elements created and added to DOM', this.container);
      } catch (err) {
        console.error('BeyondAsk Widget: Error creating widget elements', err);
      }
    }
    
    toggleChat(open = null) {
      this.isOpen = open !== null ? open : !this.isOpen;
      
      if (this.isOpen) {
        this.chatContainer.style.display = 'flex';
      } else {
        this.chatContainer.style.display = 'none';
      }
    }
  }
  
  // Initialize widget
  setTimeout(() => {
    const widget = new SimpleWidget();
    widget.init();
    
    // Expose globally
    window.beyondWidget = function(command, options) {
      console.log('BeyondWidget called with:', command, options);
      return widget;
    };
  }, 500);
})();