'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagesApi, phoneNumbersApi } from '@/lib/api';
import { Card, Button, Input, Badge, Spinner, EmptyState, Select, Textarea } from '@/components/ui';
import { toast } from '@/components/ui/Toaster';
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  PhoneIcon,
  ArrowLeftIcon,
  InboxIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

function ConversationList({ conversations, selectedNumber, onSelect }) {
  if (!conversations || conversations.length === 0) {
    return (
      <EmptyState
        icon={InboxIcon}
        title="No conversations"
        description="Send your first SMS or receive one to see conversations here"
      />
    );
  }

  return (
    <div className="divide-y divide-secondary-200 dark:divide-secondary-700">
      {conversations.map((conv) => (
        <button
          key={conv.externalNumber}
          onClick={() => onSelect(conv.externalNumber)}
          className={clsx(
            'w-full text-left p-4 hover:bg-secondary-50 dark:hover:bg-secondary-700/50 transition-colors',
            selectedNumber === conv.externalNumber && 'bg-primary-50 dark:bg-primary-900/20'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-secondary-100 dark:bg-secondary-700">
                <PhoneIcon className="h-4 w-4 text-secondary-600 dark:text-secondary-400" />
              </div>
              <div>
                <p className="font-medium text-secondary-900 dark:text-white text-sm">
                  {conv.externalNumber}
                </p>
                <p className="text-xs text-secondary-500 truncate max-w-[200px]">
                  {conv.lastMessage?.body}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-secondary-400">
                {new Date(conv.lastMessage?.createdAt).toLocaleDateString()}
              </p>
              {conv.unreadCount > 0 && (
                <Badge variant="primary" className="mt-1">
                  {conv.unreadCount}
                </Badge>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function MessageThread({ phoneNumber, onBack }) {
  const queryClient = useQueryClient();
  const messagesEndRef = useRef(null);
  const [newMessage, setNewMessage] = useState('');

  const { data: thread, isLoading } = useQuery({
    queryKey: ['message-thread', phoneNumber],
    queryFn: () => messagesApi.getThread(phoneNumber).then(r => r.data),
    enabled: !!phoneNumber,
    refetchInterval: 5000, // Poll for new messages
  });

  const { data: phoneNumbers } = useQuery({
    queryKey: ['phone-numbers'],
    queryFn: () => phoneNumbersApi.list().then(r => r.data),
  });

  const sendMutation = useMutation({
    mutationFn: (data) => messagesApi.send(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-thread', phoneNumber] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setNewMessage('');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to send message');
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread]);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    const activeNumber = phoneNumbers?.data?.find(p => p.status === 'ACTIVE');
    if (!activeNumber) {
      toast.error('No active phone number to send from');
      return;
    }
    sendMutation.mutate({
      to: phoneNumber,
      body: newMessage,
      phoneNumberId: activeNumber.id,
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="p-4 border-b border-secondary-200 dark:border-secondary-700 flex items-center gap-3">
        <button
          onClick={onBack}
          className="lg:hidden p-1 rounded hover:bg-secondary-100 dark:hover:bg-secondary-700"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div className="p-2 rounded-full bg-secondary-100 dark:bg-secondary-700">
          <PhoneIcon className="h-4 w-4 text-secondary-600" />
        </div>
        <div>
          <p className="font-medium text-secondary-900 dark:text-white">{phoneNumber}</p>
          <p className="text-xs text-secondary-500">{thread?.data?.length || 0} messages</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          thread?.data?.map((msg) => (
            <div
              key={msg.id}
              className={clsx(
                'max-w-[75%] rounded-2xl p-3',
                msg.direction === 'OUTBOUND'
                  ? 'ml-auto bg-primary-600 text-white'
                  : 'bg-secondary-100 dark:bg-secondary-700 text-secondary-900 dark:text-white'
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
              <div className={clsx(
                'flex items-center gap-2 mt-1 text-xs',
                msg.direction === 'OUTBOUND' ? 'text-primary-200' : 'text-secondary-400'
              )}>
                <span>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.direction === 'OUTBOUND' && (
                  <Badge
                    variant={msg.status === 'DELIVERED' ? 'success' : msg.status === 'FAILED' ? 'danger' : 'secondary'}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {msg.status}
                  </Badge>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="p-4 border-t border-secondary-200 dark:border-secondary-700">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            loading={sendMutation.isPending}
            disabled={!newMessage.trim()}
          >
            <PaperAirplaneIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function NewMessageModal({ open, onClose, phoneNumbers }) {
  const queryClient = useQueryClient();
  const [to, setTo] = useState('');
  const [body, setBody] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');

  useEffect(() => {
    if (phoneNumbers?.length > 0 && !phoneNumberId) {
      setPhoneNumberId(phoneNumbers[0].id);
    }
  }, [phoneNumbers, phoneNumberId]);

  const sendMutation = useMutation({
    mutationFn: (data) => messagesApi.send(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Message sent!');
      setTo('');
      setBody('');
      onClose();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to send message');
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">
          New Message
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">To</label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="+15551234567"
            />
          </div>
          {phoneNumbers?.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">From</label>
              <Select value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)}>
                {phoneNumbers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.phoneNumber} {p.friendlyName && `(${p.friendlyName})`}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">Message</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message..."
              rows={4}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => sendMutation.mutate({ to, body, phoneNumberId })}
              loading={sendMutation.isPending}
              disabled={!to || !body}
            >
              <PaperAirplaneIcon className="h-4 w-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [showNewMessage, setShowNewMessage] = useState(false);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagesApi.getConversations().then(r => r.data),
    refetchInterval: 10000,
  });

  const { data: phoneNumbers } = useQuery({
    queryKey: ['phone-numbers'],
    queryFn: () => phoneNumbersApi.list({ status: 'ACTIVE' }).then(r => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ['message-stats'],
    queryFn: () => messagesApi.getStats().then(r => r.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const activePhoneNumbers = phoneNumbers?.data?.filter(p => p.status === 'ACTIVE') || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">
            Messages
          </h1>
          <p className="text-secondary-500 mt-1">
            SMS conversations with your callers
          </p>
        </div>
        <Button onClick={() => setShowNewMessage(true)} disabled={activePhoneNumbers.length === 0}>
          <PaperAirplaneIcon className="h-4 w-4 mr-2" />
          New Message
        </Button>
      </div>

      {/* Stats cards */}
      {stats?.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card bordered className="!p-4">
            <p className="text-xs uppercase tracking-wider text-secondary-400">Total</p>
            <p className="text-2xl font-bold text-secondary-900 dark:text-white mt-1">
              {stats.data.total}
            </p>
          </Card>
          <Card bordered className="!p-4">
            <div className="flex items-center gap-1 text-xs uppercase tracking-wider text-secondary-400">
              <ArrowUpIcon className="h-3 w-3" /> Sent
            </div>
            <p className="text-2xl font-bold text-secondary-900 dark:text-white mt-1">
              {stats.data.totalSent}
            </p>
          </Card>
          <Card bordered className="!p-4">
            <div className="flex items-center gap-1 text-xs uppercase tracking-wider text-secondary-400">
              <ArrowDownIcon className="h-3 w-3" /> Received
            </div>
            <p className="text-2xl font-bold text-secondary-900 dark:text-white mt-1">
              {stats.data.totalReceived}
            </p>
          </Card>
          <Card bordered className="!p-4">
            <p className="text-xs uppercase tracking-wider text-secondary-400">Failed</p>
            <p className="text-2xl font-bold text-danger-600 mt-1">
              {stats.data.totalFailed}
            </p>
          </Card>
        </div>
      )}

      {/* Chat interface */}
      <Card bordered className="!p-0 overflow-hidden" style={{ height: 'calc(100vh - 320px)', minHeight: '400px' }}>
        <div className="flex h-full">
          {/* Conversations list */}
          <div className={clsx(
            'w-full lg:w-80 border-r border-secondary-200 dark:border-secondary-700 overflow-y-auto',
            selectedNumber ? 'hidden lg:block' : 'block'
          )}>
            <div className="p-4 border-b border-secondary-200 dark:border-secondary-700">
              <h3 className="font-semibold text-secondary-900 dark:text-white text-sm">
                Conversations
              </h3>
            </div>
            <ConversationList
              conversations={conversations?.data}
              selectedNumber={selectedNumber}
              onSelect={setSelectedNumber}
            />
          </div>

          {/* Message thread */}
          <div className={clsx(
            'flex-1',
            selectedNumber ? 'block' : 'hidden lg:flex lg:items-center lg:justify-center'
          )}>
            {selectedNumber ? (
              <MessageThread
                phoneNumber={selectedNumber}
                onBack={() => setSelectedNumber(null)}
              />
            ) : (
              <div className="text-center text-secondary-400">
                <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto mb-2" />
                <p className="text-sm">Select a conversation to view messages</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <NewMessageModal
        open={showNewMessage}
        onClose={() => setShowNewMessage(false)}
        phoneNumbers={activePhoneNumbers}
      />
    </div>
  );
}
