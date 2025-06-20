/**
 * BeyondAsk Widget - Intercom-style Chat Widget
 * Supports dynamic theming, OTP verification, and agent linking via public key
 */
(function () {
  console.log("BeyondAsk Widget: Script loaded");

  // Global configuration defaults
  const DEFAULT_CONFIG = {
    theme: {
      primaryColor: "#0078d4",
      textColor: "#ffffff",
      backgroundColor: "#ffffff",
      secondaryTextColor: "#333333",
      inputBackgroundColor: "#f5f5f5",
    },
    position: "bottom-right",
    size: "medium",
    welcomeMessage: "Hello! How can I help you today?",
    widgetTitle: "AI Assistant",
    brandName: "BeyondAsk",
    collectName: true,
    collectEmail: true,
    collectPhone: false,
    requireOtpVerification: true,
  };

  class BeyondWidget {
    constructor() {
      this.isOpen = false;
      this.container = null;
      this.button = null;
      this.chatContainer = null;
      this.config = { ...DEFAULT_CONFIG };
      this.messages = [];
      this.conversationId = null;
      this.isAuthenticated = false;
      this.userInfo = {};
      this.currentView = "contact"; // 'contact', 'otp', 'chat'
      this.publicKey = "";
      this.otpCode = "";
      this.messagesContainer = null;
      this.apiBaseUrl = window.location.origin;

      // Detect script tag to get public key
      this.detectScriptTag();
    }

    // Extract public key from script tag data attribute
    detectScriptTag() {
      const scripts = document.getElementsByTagName("script");
      for (let i = 0; i < scripts.length; i++) {
        const script = scripts[i];
        const src = script.getAttribute("src") || "";
        if (src.includes("/widget.js")) {
          this.publicKey = script.getAttribute("data-public-key") || "";
          console.log("BeyondAsk Widget: Detected public key:", this.publicKey);
          break;
        }
      }
    }

    // Initialize widget and fetch configuration
    async init() {
      try {
        console.log("BeyondAsk Widget: Initializing...");

        if (!this.publicKey) {
          console.error(
            "BeyondAsk Widget: No public key provided. Please add data-public-key attribute to the widget script.",
          );
          return;
        }

        // Fetch config using public key
        await this.fetchConfig();

        // Create widget elements
        this.createWidgetElements();

        // Apply theme based on config
        this.applyTheme();

        // Render initial view (contact form or chat)
        this.renderView();

        console.log("BeyondAsk Widget: Initialization complete");
      } catch (err) {
        console.error("BeyondAsk Widget: Error initializing widget", err);
      }
    }

    // Fetch widget configuration from server
    async fetchConfig() {
      try {
        console.log(
          `BeyondAsk Widget: Fetching configuration for public key: ${this.publicKey}`,
        );
        const response = await fetch(
          `${this.apiBaseUrl}/api/public/widgets/${this.publicKey}/config`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch widget configuration");
        }

        const data = await response.json();
        this.config = { ...DEFAULT_CONFIG, ...data };
        console.log("BeyondAsk Widget: Configuration loaded:", this.config);
      } catch (err) {
        console.error(
          "BeyondAsk Widget: Error fetching configuration, using defaults",
          err,
        );
      }
    }

    // Create all widget DOM elements
    createWidgetElements() {
      // Create widget container
      this.container = document.createElement("div");
      this.container.id = "beyond-widget-container";
      this.container.style.position = "fixed";
      this.container.style.zIndex = "999999";
      this.container.style.fontFamily =
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

      // Set position based on config
      this.setWidgetPosition();

      // Create chat button
      this.createChatButton();

      // Create chat container
      this.createChatContainer();

      // Add to document
      document.body.appendChild(this.container);
    }

    // Set the widget position based on config
    setWidgetPosition() {
      switch (this.config.position) {
        case "top-left":
          this.container.style.top = "20px";
          this.container.style.left = "20px";
          break;
        case "top-right":
          this.container.style.top = "20px";
          this.container.style.right = "20px";
          break;
        case "bottom-left":
          this.container.style.bottom = "20px";
          this.container.style.left = "20px";
          break;
        case "bottom-right":
        default:
          this.container.style.bottom = "20px";
          this.container.style.right = "20px";
          break;
      }
    }

    // Create the chat bubble button
    createChatButton() {
      this.button = document.createElement("div");
      this.button.id = "beyond-widget-button";
      this.button.style.width = "60px";
      this.button.style.height = "60px";
      this.button.style.borderRadius = "50%";
      this.button.style.display = "flex";
      this.button.style.alignItems = "center";
      this.button.style.justifyContent = "center";
      this.button.style.cursor = "pointer";
      this.button.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
      this.button.style.transition = "transform 0.3s ease";

      // Add message icon
      this.button.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';

      // Add hover effect
      this.button.addEventListener("mouseover", () => {
        this.button.style.transform = "scale(1.05)";
      });

      this.button.addEventListener("mouseout", () => {
        this.button.style.transform = "scale(1)";
      });

      // Add click handler
      this.button.addEventListener("click", () => this.toggleChat());

      // Add to container
      this.container.appendChild(this.button);
    }

    // Create the chat panel container
    createChatContainer() {
      this.chatContainer = document.createElement("div");
      this.chatContainer.id = "beyond-chat-container";
      this.chatContainer.style.position = "absolute";
      this.chatContainer.style.width = "350px";
      this.chatContainer.style.height = "500px";
      this.chatContainer.style.backgroundColor = "#ffffff";
      this.chatContainer.style.borderRadius = "12px";
      this.chatContainer.style.boxShadow = "0 5px 40px rgba(0, 0, 0, 0.2)";
      this.chatContainer.style.display = "none";
      this.chatContainer.style.flexDirection = "column";
      this.chatContainer.style.overflow = "hidden";
      this.chatContainer.style.transition = "all 0.3s ease";

      // Set position based on config
      switch (this.config.position) {
        case "top-left":
          this.chatContainer.style.top = "80px";
          this.chatContainer.style.left = "0";
          break;
        case "top-right":
          this.chatContainer.style.top = "80px";
          this.chatContainer.style.right = "0";
          break;
        case "bottom-left":
          this.chatContainer.style.bottom = "80px";
          this.chatContainer.style.left = "0";
          break;
        case "bottom-right":
        default:
          this.chatContainer.style.bottom = "80px";
          this.chatContainer.style.right = "0";
          break;
      }

      // Set size based on config
      switch (this.config.size) {
        case "small":
          this.chatContainer.style.width = "300px";
          this.chatContainer.style.height = "400px";
          break;
        case "large":
          this.chatContainer.style.width = "380px";
          this.chatContainer.style.height = "550px";
          break;
        case "medium":
        default:
          this.chatContainer.style.width = "350px";
          this.chatContainer.style.height = "500px";
          break;
      }

      // Add to container
      this.container.appendChild(this.chatContainer);
    }

    // Apply theme colors from config
    applyTheme() {
      // Button theme
      this.button.style.backgroundColor = this.config.theme.primaryColor;
      this.button.style.color = this.config.theme.textColor;

      // Header theme will be applied in renderHeader()
    }

    // Render the appropriate view based on state
    renderView() {
      // Clear existing content
      this.chatContainer.innerHTML = "";

      // Add header
      this.renderHeader();

      // Render content based on current view
      switch (this.currentView) {
        case "contact":
          this.renderContactForm();
          break;
        case "otp":
          this.renderOtpVerification();
          break;
        case "chat":
          this.renderChatInterface();
          break;
        default:
          this.renderContactForm();
      }
    }

    // Render the header with title and close button
    renderHeader() {
      const header = document.createElement("div");
      header.style.padding = "15px";
      header.style.backgroundColor = this.config.theme.primaryColor;
      header.style.color = this.config.theme.textColor;
      header.style.display = "flex";
      header.style.justifyContent = "space-between";
      header.style.alignItems = "center";

      const headerTitle = document.createElement("div");
      headerTitle.innerHTML = `<h3 style="margin:0;font-size:16px;font-weight:600;">${this.config.widgetTitle}</h3>`;

      const closeButton = document.createElement("button");
      closeButton.innerHTML = "&times;";
      closeButton.style.background = "none";
      closeButton.style.border = "none";
      closeButton.style.color = this.config.theme.textColor;
      closeButton.style.fontSize = "20px";
      closeButton.style.cursor = "pointer";
      closeButton.style.padding = "0";
      closeButton.style.width = "24px";
      closeButton.style.height = "24px";
      closeButton.style.display = "flex";
      closeButton.style.alignItems = "center";
      closeButton.style.justifyContent = "center";

      closeButton.addEventListener("click", () => this.toggleChat(false));

      header.appendChild(headerTitle);
      header.appendChild(closeButton);

      this.chatContainer.appendChild(header);
    }

    // Render the contact information form
    renderContactForm() {
      const formContainer = document.createElement("div");
      formContainer.style.padding = "20px";
      formContainer.style.height = "calc(100% - 105px)";
      formContainer.style.overflowY = "auto";
      formContainer.style.display = "flex";
      formContainer.style.flexDirection = "column";

      // Welcome message
      const welcomeMsg = document.createElement("p");
      welcomeMsg.textContent =
        this.config.welcomeMessage ||
        "Welcome! Please provide your information to get started.";
      welcomeMsg.style.marginBottom = "20px";
      welcomeMsg.style.fontSize = "14px";
      welcomeMsg.style.color = this.config.theme.secondaryTextColor;
      formContainer.appendChild(welcomeMsg);

      // Create form
      const form = document.createElement("form");
      form.style.display = "flex";
      form.style.flexDirection = "column";
      form.style.gap = "15px";
      form.style.flex = "1";
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleContactSubmit();
      });

      // Name field (if enabled)
      if (this.config.collectName) {
        const nameGroup = this.createFormGroup(
          "Name",
          "text",
          "beyond-name-input",
          true,
        );
        form.appendChild(nameGroup);
      }

      // Email field (if enabled)
      if (this.config.collectEmail) {
        const emailGroup = this.createFormGroup(
          "Email",
          "email",
          "beyond-email-input",
          true,
        );
        form.appendChild(emailGroup);
      }

      // Phone field (if enabled)
      if (this.config.collectPhone) {
        const phoneGroup = this.createFormGroup(
          "Phone",
          "tel",
          "beyond-phone-input",
          false,
        );
        form.appendChild(phoneGroup);
      }

      // Submit button
      const submitBtn = document.createElement("button");
      submitBtn.type = "submit";
      submitBtn.textContent = "Continue";
      submitBtn.style.backgroundColor = this.config.theme.primaryColor;
      submitBtn.style.color = this.config.theme.textColor;
      submitBtn.style.border = "none";
      submitBtn.style.borderRadius = "4px";
      submitBtn.style.padding = "10px";
      submitBtn.style.cursor = "pointer";
      submitBtn.style.fontWeight = "500";
      submitBtn.style.marginTop = "10px";
      form.appendChild(submitBtn);

      formContainer.appendChild(form);
      this.chatContainer.appendChild(formContainer);
    }

    // Create a form input group (label + input)
    createFormGroup(label, type, id, required) {
      const group = document.createElement("div");
      group.style.display = "flex";
      group.style.flexDirection = "column";
      group.style.gap = "5px";

      const labelEl = document.createElement("label");
      labelEl.setAttribute("for", id);
      labelEl.textContent = required ? `${label} *` : label;
      labelEl.style.fontSize = "14px";
      labelEl.style.fontWeight = "500";
      labelEl.style.color = this.config.theme.secondaryTextColor;

      const input = document.createElement("input");
      input.type = type;
      input.id = id;
      input.required = required;
      input.style.padding = "10px";
      input.style.borderRadius = "4px";
      input.style.border = "1px solid #e1e1e1";
      input.style.fontSize = "14px";
      input.style.backgroundColor =
        this.config.theme.inputBackgroundColor || "#f5f5f5";
      input.style.color = this.config.theme.secondaryTextColor;

      group.appendChild(labelEl);
      group.appendChild(input);

      return group;
    }

    // Handle submission of contact form
    async handleContactSubmit() {
      try {
        // Get form values
        const name = document.getElementById("beyond-name-input")?.value || "";
        const email =
          document.getElementById("beyond-email-input")?.value || "";
        const phone =
          document.getElementById("beyond-phone-input")?.value || "";

        // Store user info
        this.userInfo = { name, email, phone };

        // If OTP verification is required, go to OTP screen
        if (this.config.requireOtpVerification && email) {
          await this.sendOtp(email, name);
          this.currentView = "otp";
          this.renderView();
        } else {
          // Otherwise go straight to chat
          this.isAuthenticated = true;
          this.currentView = "chat";
          this.renderView();
        }
      } catch (err) {
        console.error("BeyondAsk Widget: Error submitting contact form", err);
        this.showError(
          "There was a problem submitting your information. Please try again.",
        );
      }
    }

    // Send OTP to the user's email
    async sendOtp(email, name = "") {
      try {
        const response = await fetch(
          `${this.apiBaseUrl}/api/public/widgets/${this.publicKey}/otp`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, name }),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to send OTP");
        }

        const data = await response.json();
        return data.success;
      } catch (err) {
        console.error("BeyondAsk Widget: Error sending OTP", err);
        throw err;
      }
    }

    // Render OTP verification screen
    renderOtpVerification() {
      const otpContainer = document.createElement("div");
      otpContainer.style.padding = "20px";
      otpContainer.style.height = "calc(100% - 105px)";
      otpContainer.style.overflowY = "auto";
      otpContainer.style.display = "flex";
      otpContainer.style.flexDirection = "column";

      // Instructions
      const instructions = document.createElement("p");
      instructions.textContent = `We've sent a verification code to ${this.userInfo.email}. Please enter it below to continue.`;
      instructions.style.marginBottom = "20px";
      instructions.style.fontSize = "14px";
      instructions.style.color = this.config.theme.secondaryTextColor;
      otpContainer.appendChild(instructions);

      // OTP form
      const form = document.createElement("form");
      form.style.display = "flex";
      form.style.flexDirection = "column";
      form.style.gap = "15px";
      form.style.flex = "1";
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.verifyOtp();
      });

      // OTP input
      const otpGroup = this.createFormGroup(
        "Verification Code",
        "text",
        "beyond-otp-input",
        true,
      );
      form.appendChild(otpGroup);

      // Submit button
      const submitBtn = document.createElement("button");
      submitBtn.type = "submit";
      submitBtn.textContent = "Verify";
      submitBtn.style.backgroundColor = this.config.theme.primaryColor;
      submitBtn.style.color = this.config.theme.textColor;
      submitBtn.style.border = "none";
      submitBtn.style.borderRadius = "4px";
      submitBtn.style.padding = "10px";
      submitBtn.style.cursor = "pointer";
      submitBtn.style.fontWeight = "500";
      submitBtn.style.marginTop = "10px";
      form.appendChild(submitBtn);

      // Back button
      const backBtn = document.createElement("button");
      backBtn.type = "button";
      backBtn.textContent = "Back";
      backBtn.style.backgroundColor = "transparent";
      backBtn.style.color = this.config.theme.secondaryTextColor;
      backBtn.style.border = "none";
      backBtn.style.padding = "10px";
      backBtn.style.cursor = "pointer";
      backBtn.style.marginTop = "10px";
      backBtn.style.textDecoration = "underline";
      backBtn.style.textUnderlineOffset = "2px";
      backBtn.addEventListener("click", () => {
        this.currentView = "contact";
        this.renderView();
      });
      form.appendChild(backBtn);

      otpContainer.appendChild(form);
      this.chatContainer.appendChild(otpContainer);

      // Focus OTP input
      setTimeout(() => {
        document.getElementById("beyond-otp-input")?.focus();
      }, 100);
    }

    // Verify the OTP entered by user
    async verifyOtp() {
      try {
        const otpCode =
          document.getElementById("beyond-otp-input")?.value || "";

        if (!otpCode) {
          this.showError("Please enter the verification code");
          return;
        }

        const response = await fetch(
          `${this.apiBaseUrl}/api/public/widgets/${this.publicKey}/verify-otp`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: this.userInfo.email,
              code: otpCode,
            }),
          },
        );

        if (!response.ok) {
          throw new Error("Invalid verification code");
        }

        const data = await response.json();

        if (data.token) {
          // Store auth token
          this.authToken = data.token;
          this.isAuthenticated = true;

          // Move to chat interface
          this.currentView = "chat";
          this.renderView();

          // Load messages if any
          this.loadMessages();
        } else {
          throw new Error("Failed to authenticate");
        }
      } catch (err) {
        console.error("BeyondAsk Widget: Error verifying OTP", err);
        this.showError("Invalid verification code. Please try again.");
      }
    }

    // Render chat interface
    renderChatInterface() {
      // Chat content container
      const chatContent = document.createElement("div");
      chatContent.style.display = "flex";
      chatContent.style.flexDirection = "column";
      chatContent.style.height = "calc(100% - 55px)";

      // Messages container
      this.messagesContainer = document.createElement("div");
      this.messagesContainer.style.flex = "1";
      this.messagesContainer.style.overflowY = "auto";
      this.messagesContainer.style.padding = "15px";
      this.messagesContainer.style.display = "flex";
      this.messagesContainer.style.flexDirection = "column";
      chatContent.appendChild(this.messagesContainer);

      // Welcome message
      if (this.messages.length === 0) {
        this.addAssistantMessage(
          this.config.welcomeMessage || "Hello! How can I help you today?",
        );
      } else {
        // Render existing messages
        this.renderMessages();
      }

      // Input area
      const inputArea = document.createElement("div");
      inputArea.style.padding = "10px";
      inputArea.style.borderTop = "1px solid #e1e1e1";
      inputArea.style.display = "flex";
      inputArea.style.gap = "10px";

      const input = document.createElement("input");
      input.type = "text";
      input.id = "beyond-message-input";
      input.placeholder = "Type your message...";
      input.style.flex = "1";
      input.style.padding = "10px";
      input.style.border = "1px solid #ddd";
      input.style.borderRadius = "4px";
      input.style.fontSize = "14px";
      input.style.backgroundColor =
        this.config.theme.inputBackgroundColor || "#f5f5f5";

      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && input.value.trim()) {
          this.sendMessage(input.value);
          input.value = "";
        }
      });

      const sendButton = document.createElement("button");
      sendButton.innerText = "Send";
      sendButton.style.padding = "10px 15px";
      sendButton.style.backgroundColor = this.config.theme.primaryColor;
      sendButton.style.color = this.config.theme.textColor;
      sendButton.style.border = "none";
      sendButton.style.borderRadius = "4px";
      sendButton.style.cursor = "pointer";
      sendButton.style.fontWeight = "500";

      sendButton.addEventListener("click", () => {
        if (input.value.trim()) {
          this.sendMessage(input.value);
          input.value = "";
        }
      });

      inputArea.appendChild(input);
      inputArea.appendChild(sendButton);

      chatContent.appendChild(inputArea);
      this.chatContainer.appendChild(chatContent);

      // Focus input
      setTimeout(() => {
        input.focus();
      }, 100);
    }

    // Load existing messages for conversation if any
    async loadMessages() {
      if (!this.conversationId) return;

      try {
        const response = await fetch(
          `${this.apiBaseUrl}/api/public/widgets/${this.publicKey}/conversations/${this.conversationId}${
            this.authToken ? `?token=${this.authToken}` : ""
          }`,
        );

        if (!response.ok) {
          throw new Error("Failed to load messages");
        }

        const data = await response.json();
        this.messages = data.messages || [];

        // Render messages
        this.renderMessages();
      } catch (err) {
        console.error("BeyondAsk Widget: Error loading messages", err);
      }
    }

    // Render all messages in the conversation
    renderMessages() {
      if (!this.messagesContainer) return;

      // Clear messages container
      this.messagesContainer.innerHTML = "";

      // Add each message
      this.messages.forEach((message) => {
        if (message.role === "user") {
          this.renderUserMessage(message.content);
        } else if (message.role === "assistant") {
          this.renderAssistantMessage(message.content, message.citations);
        }
      });

      // Scroll to bottom
      this.scrollToBottom();
    }

    // Render a user message
    renderUserMessage(content) {
      const messageEl = document.createElement("div");
      messageEl.style.alignSelf = "flex-end";
      messageEl.style.maxWidth = "80%";
      messageEl.style.padding = "10px 12px";
      messageEl.style.marginBottom = "10px";
      messageEl.style.backgroundColor = this.config.theme.primaryColor;
      messageEl.style.color = this.config.theme.textColor;
      messageEl.style.borderRadius = "12px 12px 0 12px";
      messageEl.style.wordBreak = "break-word";
      messageEl.innerHTML = `<p style="margin:0;font-size:14px;">${this.escapeHtml(content)}</p>`;

      this.messagesContainer.appendChild(messageEl);
      this.scrollToBottom();
    }

    // Render an assistant message
    renderAssistantMessage(content, citations = []) {
      const messageEl = document.createElement("div");
      messageEl.style.alignSelf = "flex-start";
      messageEl.style.maxWidth = "80%";
      messageEl.style.padding = "10px 12px";
      messageEl.style.marginBottom = "10px";
      messageEl.style.backgroundColor = "#f1f1f1";
      messageEl.style.color = this.config.theme.secondaryTextColor;
      messageEl.style.borderRadius = "12px 12px 12px 0";
      messageEl.style.wordBreak = "break-word";
      messageEl.innerHTML = `<p style="margin:0;font-size:14px;">${this.escapeHtml(content)}</p>`;

      // Add citations if any
      if (citations && citations.length > 0) {
        const citationsEl = document.createElement("div");
        citationsEl.style.marginTop = "8px";
        citationsEl.style.paddingTop = "8px";
        citationsEl.style.borderTop = "1px solid #e1e1e1";
        citationsEl.style.fontSize = "12px";

        let citationsHtml =
          '<p style="margin:0;font-size:12px;font-style:italic;">Sources:</p><ul style="margin:5px 0 0 0;padding-left:20px;">';
        citations.forEach((citation) => {
          const source = citation.metadata?.source || "Unknown";
          citationsHtml += `<li>${this.escapeHtml(source)}</li>`;
        });
        citationsHtml += "</ul>";

        citationsEl.innerHTML = citationsHtml;
        messageEl.appendChild(citationsEl);
      }

      this.messagesContainer.appendChild(messageEl);
      this.scrollToBottom();
    }

    // Add a user message to the conversation
    addUserMessage(content) {
      this.messages.push({
        role: "user",
        content,
        createdAt: new Date(),
      });

      this.renderUserMessage(content);
    }

    // Add an assistant message to the conversation
    addAssistantMessage(content, citations = []) {
      this.messages.push({
        role: "assistant",
        content,
        citations,
        createdAt: new Date(),
      });

      this.renderAssistantMessage(content, citations);
    }

    // Send a user message to the server
    async sendMessage(message) {
      if (!message.trim()) return;

      try {
        // Add user message immediately
        this.addUserMessage(message);

        // Add typing indicator
        const typingIndicator = this.addTypingIndicator();

        // Send message to server
        const response = await fetch(
          `${this.apiBaseUrl}/api/public/widgets/${this.publicKey}/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token: this.authToken,
              message,
              conversationId: this.conversationId,
            }),
          },
        );

        // Remove typing indicator
        this.removeTypingIndicator(typingIndicator);

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        const data = await response.json();

        // Store conversation ID if new
        if (data.conversationId && !this.conversationId) {
          this.conversationId = data.conversationId;
        }

        // Add assistant response
        if (data.message) {
          this.addAssistantMessage(
            data.message.content,
            data.message.citations,
          );
        } else if (data.content) {
          this.addAssistantMessage(data.content, data.citations);
        } else {
          this.addAssistantMessage(
            "Sorry, I couldn't process your request. Please try again.",
          );
        }
      } catch (err) {
        console.error("BeyondAsk Widget: Error sending message", err);
        this.addAssistantMessage(
          "Sorry, there was an error processing your message. Please try again.",
        );
      }
    }

    // Add typing indicator while waiting for response
    addTypingIndicator() {
      const indicator = document.createElement("div");
      indicator.style.alignSelf = "flex-start";
      indicator.style.padding = "10px 12px";
      indicator.style.marginBottom = "10px";
      indicator.style.backgroundColor = "#f1f1f1";
      indicator.style.color = this.config.theme.secondaryTextColor;
      indicator.style.borderRadius = "12px 12px 12px 0";
      indicator.style.display = "flex";
      indicator.style.gap = "4px";
      indicator.style.alignItems = "center";
      indicator.style.justifyContent = "center";
      indicator.style.height = "32px";
      indicator.style.width = "60px";

      // Create dot animation
      for (let i = 0; i < 3; i++) {
        const dot = document.createElement("div");
        dot.style.width = "6px";
        dot.style.height = "6px";
        dot.style.borderRadius = "50%";
        dot.style.backgroundColor = "#888";
        dot.style.animation = "beyondDotPulse 1.5s infinite";
        dot.style.animationDelay = `${i * 0.15}s`;
        indicator.appendChild(dot);
      }

      // Add animation keyframes
      if (!document.getElementById("beyond-animations")) {
        const style = document.createElement("style");
        style.id = "beyond-animations";
        style.textContent = `
          @keyframes beyondDotPulse {
            0%, 100% { opacity: 0.4; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.2); }
          }
        `;
        document.head.appendChild(style);
      }

      this.messagesContainer.appendChild(indicator);
      this.scrollToBottom();

      return indicator;
    }

    // Remove typing indicator
    removeTypingIndicator(indicator) {
      if (indicator && indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }

    // Scroll messages container to bottom
    scrollToBottom() {
      if (this.messagesContainer) {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      }
    }

    // Escape HTML to prevent XSS
    escapeHtml(unsafe) {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    // Display an error message
    showError(message) {
      const errorEl = document.createElement("div");
      errorEl.style.backgroundColor = "#ffebee";
      errorEl.style.color = "#c62828";
      errorEl.style.padding = "10px";
      errorEl.style.borderRadius = "4px";
      errorEl.style.marginBottom = "10px";
      errorEl.style.fontSize = "14px";
      errorEl.textContent = message;

      // If in OTP view
      if (this.currentView === "otp") {
        const form = document
          .querySelector("#beyond-otp-input")
          ?.closest("form");
        if (form) {
          form.parentNode.insertBefore(errorEl, form);
        }
      }
      // If in contact form view
      else if (this.currentView === "contact") {
        const form = document
          .querySelector("#beyond-name-input, #beyond-email-input")
          ?.closest("form");
        if (form) {
          form.parentNode.insertBefore(errorEl, form);
        }
      }

      // Remove error after 5 seconds
      setTimeout(() => {
        if (errorEl.parentNode) {
          errorEl.parentNode.removeChild(errorEl);
        }
      }, 5000);
    }

    // Toggle chat open/closed
    toggleChat(open = null) {
      this.isOpen = open !== null ? open : !this.isOpen;

      if (this.isOpen) {
        this.chatContainer.style.display = "flex";
        // In case the view was updated while closed
        this.renderView();
      } else {
        this.chatContainer.style.display = "none";
      }
    }

    escapeHtml(html) {
      const div = document.createElement("div");
      div.textContent = html;
      return div.innerHTML;
    }
  }

  // Initialize widget
  setTimeout(() => {
    const widget = new BeyondWidget();
    widget.init();

    // Expose globally with command API
    window.beyondWidget = function (command, options) {
      console.log("BeyondWidget called with:", command, options);

      switch (command) {
        case "open":
          widget.toggleChat(true);
          break;
        case "close":
          widget.toggleChat(false);
          break;
        case "toggle":
          widget.toggleChat();
          break;
        case "track":
          // Could implement event tracking here
          console.log("Track event:", options);
          break;
        case "setUser":
          // Could implement setting user info here
          console.log("Set user:", options);
          widget.userInfo = { ...widget.userInfo, ...options };
          break;
        case "setConfig":
          // Update widget configuration
          if (options) {
            console.log("Updating widget configuration:", options);
            widget.config = { ...widget.config, ...options };

            // Apply theme changes immediately
            if (options.theme) {
              widget.config.theme = {
                ...widget.config.theme,
                ...options.theme,
              };
              widget.applyTheme();
            }

            // Update widget position if changed
            if (options.position) {
              widget.setWidgetPosition();
            }

            // Update widget size if changed
            if (options.size && widget.chatContainer) {
              // Apply size based on config
              switch (options.size) {
                case "small":
                  widget.chatContainer.style.width = "300px";
                  widget.chatContainer.style.height = "400px";
                  break;
                case "large":
                  widget.chatContainer.style.width = "380px";
                  widget.chatContainer.style.height = "550px";
                  break;
                case "medium":
                default:
                  widget.chatContainer.style.width = "350px";
                  widget.chatContainer.style.height = "500px";
                  break;
              }
            }

            // If widget is open, re-render the current view to apply changes
            if (widget.isOpen) {
              widget.renderView();
            }
          }
          break;
      }

      return widget;
    };
  }, 500);
})();
