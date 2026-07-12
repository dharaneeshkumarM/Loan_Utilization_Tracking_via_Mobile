import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { generateAIResponse } from '@/lib/loan-utils';
import type { Loan, Payment, Expense, ChatMessage } from '@/types/database';
import { GlassCard } from '@/components/GlassCard';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Send, Bot, Sparkles, User } from 'lucide-react-native';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "What's my remaining balance?",
  "Give me saving tips",
  "Predict next month's expenses",
  "How much have I spent this month?",
];

export default function AssistantScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const flatListRef = useRef<FlatList>(null);

  const fetchData = useCallback(async () => {
    try {
      const [loansRes, paymentsRes, expensesRes, chatRes] = await Promise.all([
        supabase.from('loans').select('*'),
        supabase.from('payments').select('*'),
        supabase.from('expenses').select('*'),
        supabase.from('chat_messages').select('*').order('created_at', { ascending: true }).limit(50),
      ]);

      setLoans((loansRes.data || []) as Loan[]);
      setPayments((paymentsRes.data || []) as Payment[]);
      setExpenses((expensesRes.data || []) as Expense[]);

      const chatHistory = (chatRes.data || []) as ChatMessage[];
      if (chatHistory.length > 0) {
        setMessages(chatHistory.map((m) => ({ id: m.id, role: m.role, content: m.content })));
      } else {
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: `Hi! I'm your AI Financial Assistant. I can help you with:\n\n• Loan balance and EMI details\n• Spending analysis\n• Personalized saving tips\n• Expense predictions\n\nAsk me anything!`,
        }]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setThinking(true);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      await supabase.from('chat_messages').insert({
        role: 'user',
        content: text.trim(),
      });

      const response = generateAIResponse(text, loans, payments, expenses);

      await new Promise((r) => setTimeout(r, 800));

      const assistantMsg: DisplayMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      await supabase.from('chat_messages').insert({
        role: 'assistant',
        content: response,
      });
    } finally {
      setThinking(false);
    }
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  if (loading) return <LoadingScreen message={t.loading} />;

  const styles = createStyles(theme);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.botIcon}>
            <Bot size={24} color="#fff" strokeWidth={2} />
          </View>
          <View>
            <Text style={styles.headerTitle}>AI Assistant</Text>
            <Text style={styles.headerSubtitle}>Powered by Smart Analytics</Text>
          </View>
        </View>
        <Sparkles size={20} color={theme.primary} strokeWidth={2} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View style={[styles.messageRow, item.role === 'user' && styles.messageRowUser]}>
            <View style={[styles.messageAvatar, item.role === 'user' && styles.messageAvatarUser]}>
              {item.role === 'user' ? (
                <User size={14} color="#fff" strokeWidth={2} />
              ) : (
                <Bot size={14} color="#fff" strokeWidth={2} />
              )}
            </View>
            <View style={[styles.messageBubble, item.role === 'user' ? styles.messageBubbleUser : styles.messageBubbleAssistant]}>
              <Text style={[styles.messageText, { color: item.role === 'user' ? '#fff' : theme.text }]}>
                {item.content}
              </Text>
            </View>
          </View>
        )}
        ListFooterComponent={
          thinking ? (
            <View style={[styles.messageRow, styles.messageRowUser]}>
              <View style={[styles.messageAvatar, styles.messageAvatarAssistant]}>
                <Bot size={14} color="#fff" strokeWidth={2} />
              </View>
              <View style={[styles.messageBubble, styles.messageBubbleAssistant]}>
                <View style={styles.thinkingDots}>
                  <View style={[styles.thinkingDot, { backgroundColor: theme.textTertiary }]} />
                  <View style={[styles.thinkingDot, { backgroundColor: theme.textTertiary }]} />
                  <View style={[styles.thinkingDot, { backgroundColor: theme.textTertiary }]} />
                </View>
              </View>
            </View>
          ) : null
        }
      />

      {messages.length <= 1 && (
        <View style={styles.suggestions}>
          {SUGGESTED_QUESTIONS.map((q, i) => (
            <TouchableOpacity
              key={i}
              style={styles.suggestionChip}
              onPress={() => sendMessage(q)}
              activeOpacity={0.7}
            >
              <Text style={styles.suggestionText}>{q}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={t.askMeAnything}
          placeholderTextColor={theme.textTertiary}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || thinking}
          activeOpacity={0.7}
        >
          <Send size={18} color="#fff" strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(theme: typeof import('@/lib/theme').lightTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 56,
      paddingBottom: 16,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    botIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
    headerSubtitle: { fontSize: 12, color: theme.textTertiary },
    messagesList: { padding: 16, paddingBottom: 16, gap: 12 },
    messageRow: {
      flexDirection: 'row',
      gap: 8,
      maxWidth: '85%',
    },
    messageRowUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
    messageAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    messageAvatarUser: { backgroundColor: theme.primary },
    messageAvatarAssistant: { backgroundColor: theme.secondary },
    messageBubble: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 16,
    },
    messageBubbleUser: {
      backgroundColor: theme.primary,
      borderTopRightRadius: 4,
    },
    messageBubbleAssistant: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderTopLeftRadius: 4,
    },
    messageText: { fontSize: 14, lineHeight: 20 },
    thinkingDots: { flexDirection: 'row', gap: 4, paddingVertical: 4 },
    thinkingDot: { width: 8, height: 8, borderRadius: 4 },
    suggestions: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
    suggestionChip: {
      alignSelf: 'flex-start',
      backgroundColor: theme.primaryLight,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 16,
    },
    suggestionText: { fontSize: 13, fontWeight: '500', color: theme.primary },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      gap: 10,
    },
    input: {
      flex: 1,
      backgroundColor: theme.surfaceSecondary,
      borderRadius: 20,
      paddingHorizontal: 18,
      paddingVertical: 12,
      fontSize: 15,
      color: theme.text,
      maxHeight: 100,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.4 },
  });
}
