/**
 * Shared form handler for login/signup forms
 * Reduces duplication across auth pages
 */

class FormHandler {
  constructor(options) {
    this.form = document.getElementById(options.formId);
    this.submitBtn = document.getElementById(options.submitBtnId || 'submit-btn');
    this.errorMsg = document.getElementById(options.errorMsgId || 'error-message');
    this.successMsg = document.getElementById(options.successMsgId || 'success-message');
    this.onSubmit = options.onSubmit;
    this.submitText = options.submitText || 'Submit';
    this.loadingText = options.loadingText || 'Processing...';
    this.successText = options.successText || 'Success!';
    this.redirectUrl = options.redirectUrl;
    this.redirectDelay = options.redirectDelay || 1000;

    if (this.form) {
      this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }
  }

  async handleSubmit(e) {
    e.preventDefault();

    // Clear messages
    if (this.errorMsg) this.errorMsg.textContent = '';
    if (this.successMsg) this.successMsg.textContent = '';

    // Disable button and show loading
    if (this.submitBtn) {
      this.submitBtn.disabled = true;
      this.submitBtn.textContent = this.loadingText;
    }

    try {
      // Get form data
      const formData = new FormData(this.form);
      const data = Object.fromEntries(formData.entries());

      // Call the provided submit handler
      const result = await this.onSubmit(data);

      if (result.success) {
        if (this.successMsg) {
          this.successMsg.textContent = this.successText;
        }

        if (this.redirectUrl) {
          setTimeout(() => {
            window.location.href = this.redirectUrl;
          }, this.redirectDelay);
        }
      }
    } catch (error) {
      if (this.errorMsg) {
        this.errorMsg.textContent = error.message || 'An error occurred';
      }

      // Re-enable button
      if (this.submitBtn) {
        this.submitBtn.disabled = false;
        this.submitBtn.textContent = this.submitText;
      }
    }
  }

  reset() {
    if (this.form) this.form.reset();
    if (this.errorMsg) this.errorMsg.textContent = '';
    if (this.successMsg) this.successMsg.textContent = '';
    if (this.submitBtn) {
      this.submitBtn.disabled = false;
      this.submitBtn.textContent = this.submitText;
    }
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FormHandler };
}
