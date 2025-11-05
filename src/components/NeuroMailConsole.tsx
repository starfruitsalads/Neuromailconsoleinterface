import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, Loader2, Mail, Sparkles, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { AnimatedBackground } from "./AnimatedBackground";
import { toast } from "sonner@2.0.3";
import { createClient } from "../utils/supabase/client";

interface BackendResponse {
  recipient: string;
  subject: string;
  formattedMessage: string;
}

export function NeuroMailConsole() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [backendResponse, setBackendResponse] = useState<BackendResponse | null>(null);
  const [displayedText, setDisplayedText] = useState("");
  const [editableText, setEditableText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showSendButton, setShowSendButton] = useState(false);

  const supabase = createClient();

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          setUser({ email: session.user.email });
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setIsAuthLoading(false);
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setUser({ email: session.user.email });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Process message via n8n webhook
  const processMessage = async (text: string) => {
    setIsProcessing(true);
    setBackendResponse(null);
    setDisplayedText("");
    setEditableText("");
    setShowSendButton(false);

    try {
      const res = await fetch('https://atsolutions.one/webhook/emailconsole', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: text }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      console.log('Response from n8n:', data);

      // Map response to expected format
      const response: BackendResponse = {
        recipient: data.recipient || data.to || "unknown@example.com",
        subject: data.subject || "No subject",
        formattedMessage: data.formattedMessage || data.message || data.body || text
      };

      setBackendResponse(response);
      setIsProcessing(false);
      setIsTyping(true);
    } catch (err) {
      console.error('Error connecting to n8n:', err);
      toast.error('Failed to process message', {
        description: 'Could not connect to the server. Please try again.'
      });
      setIsProcessing(false);
    }
  };

  // Letter-by-letter typing effect
  useEffect(() => {
    if (!isTyping || !backendResponse) return;

    let currentIndex = 0;
    const fullText = backendResponse.formattedMessage;

    const typingInterval = setInterval(() => {
      if (currentIndex < fullText.length) {
        setDisplayedText(fullText.substring(0, currentIndex + 1));
        currentIndex++;
      } else {
        setIsTyping(false);
        setEditableText(fullText);
        setShowSendButton(true);
        clearInterval(typingInterval);
      }
    }, 30);

    return () => clearInterval(typingInterval);
  }, [isTyping, backendResponse]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      processMessage(inputText);
    }
  };

  const handleSendToRecipient = async () => {
    if (!backendResponse || !user) return;

    try {
      // Optional: Send final confirmation to n8n to actually send the email
      const res = await fetch('https://atsolutions.one/webhook/emailconsole', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send',
          from: user.email,
          recipient: backendResponse.recipient,
          subject: backendResponse.subject,
          message: editableText || backendResponse.formattedMessage
        }),
      });

      if (res.ok) {
        toast.success(`Email sent to ${backendResponse.recipient}`, {
          description: `Subject: ${backendResponse.subject}`
        });
      } else {
        throw new Error('Failed to send email');
      }
    } catch (err) {
      console.error('Error sending email:', err);
      toast.error('Failed to send email', {
        description: 'Could not send the email. Please try again.'
      });
    }
    
    // Reset after sending
    setTimeout(() => {
      setInputText("");
      setBackendResponse(null);
      setDisplayedText("");
      setEditableText("");
      setShowSendButton(false);
    }, 1500);
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        }
      });

      if (error) {
        console.error('Google sign in error:', error);
        toast.error('Authentication failed', {
          description: 'Could not sign in with Google. Please try again.'
        });
      }
    } catch (err) {
      console.error('Error signing in with Google:', err);
      toast.error('Authentication error', {
        description: 'An unexpected error occurred.'
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setInputText("");
      setBackendResponse(null);
      setDisplayedText("");
      setEditableText("");
      setShowSendButton(false);
      toast.success('Signed out successfully');
    } catch (err) {
      console.error('Error signing out:', err);
      toast.error('Sign out failed');
    }
  };

  // Show loading state
  if (isAuthLoading) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden">
        <AnimatedBackground />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden">
        <AnimatedBackground />
        
        <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-md"
          >
            {/* Header */}
            <div className="mb-8 text-center">
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 mb-4"
              >
                <Sparkles className="w-8 h-8 text-gray-300" />
                <h1 className="text-5xl text-transparent bg-clip-text bg-gradient-to-r from-gray-200 via-gray-300 to-gray-400">
                  neuromail
                </h1>
              </motion.div>
              <p className="text-gray-500">AI-Powered Email Assistant</p>
            </div>

            {/* Login Container */}
            <motion.div
              className="relative backdrop-blur-xl bg-black/40 border border-gray-500/15 rounded-2xl shadow-2xl overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gray-400/5 via-transparent to-gray-500/5 opacity-50" />
              
              <div className="relative p-8">
                <h2 className="text-2xl text-gray-200 mb-4 text-center">Sign in to continue</h2>
                <p className="text-gray-400 text-sm mb-8 text-center">
                  Authenticate with Google to use the email console
                </p>
                
                <Button
                  onClick={handleGoogleSignIn}
                  className="w-full bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-400 hover:to-gray-500 text-white"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </Button>

                <p className="text-gray-500 text-xs mt-6 text-center">
                  By signing in, you agree to our terms of service
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <AnimatedBackground />
      
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-3xl"
        >
          {/* Header */}
          <div className="mb-8 text-center relative">
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 mb-4"
            >
              <Sparkles className="w-8 h-8 text-gray-300" />
              <h1 className="text-5xl text-transparent bg-clip-text bg-gradient-to-r from-gray-200 via-gray-300 to-gray-400">
                neuromail
              </h1>
            </motion.div>
            <p className="text-gray-500">AI-Powered Email Assistant</p>
            
            {/* Sign out button */}
            <motion.button
              onClick={handleSignOut}
              className="absolute top-0 right-0 flex items-center gap-2 text-gray-400 hover:text-gray-300 transition-colors text-sm"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </motion.button>
          </div>

          {/* Console Container */}
          <motion.div
            className="relative backdrop-blur-xl bg-black/40 border border-gray-500/15 rounded-2xl shadow-2xl overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-400/5 via-transparent to-gray-500/5 opacity-50" />
            
            <div className="relative p-6">
              {/* From Info */}
              {user && (
                <div className="flex items-center gap-2 text-sm mb-4 pb-4 border-b border-gray-500/15">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">From:</span>
                  <span className="text-gray-200">{user.email}</span>
                </div>
              )}

              {/* Input Section */}
              <form onSubmit={handleSubmit} className="mb-6">
                <div className="relative">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Enter your message..."
                    disabled={isProcessing || isTyping}
                    className="w-full bg-black/50 border border-gray-500/15 rounded-lg p-4 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-400/20 transition-all resize-none min-h-[120px]"
                    rows={4}
                  />
                  <motion.button
                    type="submit"
                    disabled={!inputText.trim() || isProcessing || isTyping}
                    className="absolute bottom-4 right-4 bg-gradient-to-r from-gray-500 to-gray-600 text-white p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-gray-400 hover:to-gray-500 transition-all"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </motion.button>
                </div>
              </form>

              {/* Processing Indicator */}
              <AnimatePresence>
                {isProcessing && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6"
                  >
                    <div className="flex items-center gap-3 p-4 bg-gray-500/10 border border-gray-500/15 rounded-lg">
                      <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
                      <span className="text-gray-300">Processing with AI...</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Response Section */}
              <AnimatePresence>
                {backendResponse && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-4"
                  >
                    {/* Recipient Info */}
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-500">To:</span>
                      <span className="text-gray-200">{backendResponse.recipient}</span>
                    </div>

                    {/* Subject */}
                    <div className="text-sm">
                      <span className="text-gray-500">Subject: </span>
                      <span className="text-gray-300">{backendResponse.subject}</span>
                    </div>

                    {/* Formatted Message */}
                    <div className="bg-black/30 border border-gray-500/15 rounded-lg p-4 min-h-[200px]">
                      {isTyping ? (
                        <pre className="text-gray-300 whitespace-pre-wrap font-mono text-sm">
                          {displayedText}
                          <motion.span
                            animate={{ opacity: [1, 0] }}
                            transition={{ duration: 0.5, repeat: Infinity }}
                            className="inline-block w-2 h-4 bg-gray-400 ml-1"
                          />
                        </pre>
                      ) : (
                        <textarea
                          value={editableText}
                          onChange={(e) => setEditableText(e.target.value)}
                          className="w-full bg-transparent text-gray-300 whitespace-pre-wrap font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gray-400/30 rounded p-2 min-h-[180px] resize-none"
                        />
                      )}
                    </div>

                    {/* Send Button */}
                    <AnimatePresence>
                      {showSendButton && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="flex justify-end"
                        >
                          <Button
                            onClick={handleSendToRecipient}
                            className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-400 hover:to-gray-500 text-white"
                          >
                            <Mail className="w-4 h-4 mr-2" />
                            Send to Recipient
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Footer hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center text-gray-500 text-sm mt-6"
          >
            Powered by Neural Network AI • Type your message and let AI handle the rest
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
