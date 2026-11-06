import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Mail, Lock, Eye, EyeOff, ArrowRight, ChevronLeft, Rocket, Shield } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import type { Lang } from '../translations';
import { WECHAT_GREEN, WeChatIcon, WeChatQrPanel } from './WeChatLogin';

interface LoginPageProps {
  onBack: () => void;
  onLoginSuccess: () => void;
  lang: Lang;
}

export const LoginPage = ({ onBack, onLoginSuccess, lang }: LoginPageProps) => {
  const zh = lang === 'zh';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [method, setMethod] = useState<'email' | 'wechat'>('email');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // 模拟登录延迟
    setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess();
    }, 1500);
  };

  return (
    <div className="min-h-screen w-full bg-black text-white relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-b from-cyan-800/20 to-purple-800/20 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[10%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-t from-purple-800/20 to-cyan-800/20 rounded-full blur-[100px] animate-pulse-slow" />
      </div>

      {/* Back button */}
      <div className="absolute top-6 left-6 z-10">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          {zh ? '返回' : 'Back'}
        </Button>
      </div>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-600/20 border border-cyan-500/30 mb-6"
            >
              <Rocket className="w-8 h-8 text-cyan-400" />
            </motion.div>

            <h1 className="text-3xl font-bold mb-2">
              <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                {zh ? '生态创业者工作台' : 'Creator Studio'}
              </span>
            </h1>
            <p className="text-gray-400 text-sm">
              {zh ? '登录以管理你的AI艺人生态' : 'Sign in to manage your AI artist ecosystem'}
            </p>
          </div>

          {/* Login form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8"
          >
            {/* Sign-in method switch */}
            <div role="tablist" aria-label={zh ? '登录方式' : 'Sign-in method'} className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/5 p-1 mb-6">
              {([
                ['email', zh ? '邮箱登录' : 'Email', <Mail key="i" className="w-4 h-4" />],
                ['wechat', zh ? '微信登录' : 'WeChat', <WeChatIcon key="i" className="w-4 h-4" color={method === 'wechat' ? WECHAT_GREEN : 'currentColor'} />],
              ] as const).map(([id, label, icon]) => (
                <button key={id} type="button" role="tab" aria-selected={method === id} onClick={() => setMethod(id)}
                  className={`relative h-9 rounded-lg text-sm inline-flex items-center justify-center gap-1.5 transition ${method === id ? 'text-white font-semibold' : 'text-gray-400 hover:text-gray-200'}`}>
                  {method === id && <motion.span layoutId="login-method" className="absolute inset-0 rounded-lg bg-white/10 border border-white/10" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                  <span className="relative inline-flex items-center gap-1.5">{icon}{label}</span>
                </button>
              ))}
            </div>

            {method === 'wechat' ? (
              <motion.div key="wechat" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .25 }}>
                <WeChatQrPanel lang={lang} onSuccess={onLoginSuccess} />
                <div className="mt-6 pt-5 border-t border-white/10 text-center text-sm">
                  <button type="button" onClick={() => setMethod('email')} className="text-cyan-400 hover:text-cyan-300 transition">
                    {zh ? '使用邮箱密码登录' : 'Sign in with email instead'}
                  </button>
                </div>
              </motion.div>
            ) : (
            <motion.div key="email" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .25 }}>
            <form onSubmit={handleLogin} className="space-y-6">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-gray-300">
                  {zh ? '邮箱地址' : 'Email'}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={zh ? '请输入邮箱' : 'Enter your email'}
                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-cyan-500/50"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-gray-300">
                  {zh ? '密码' : 'Password'}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={zh ? '请输入密码' : 'Enter your password'}
                    className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-cyan-500/50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Forgot password */}
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
                  <input type="checkbox" className="rounded border-white/20 bg-white/5" />
                  {zh ? '记住我' : 'Remember me'}
                </label>
                <button type="button" className="text-cyan-400 hover:text-cyan-300 transition">
                  {zh ? '忘记密码？' : 'Forgot password?'}
                </button>
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 text-white font-medium"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {zh ? '登录中...' : 'Signing in...'}
                  </div>
                ) : (
                  <>
                    {zh ? '登录' : 'Sign In'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-gray-900/50 text-gray-500">
                  {zh ? '或' : 'OR'}
                </span>
              </div>
            </div>

            {/* WeChat sign-in */}
            <button type="button" onClick={() => setMethod('wechat')}
              className="w-full h-12 rounded-md inline-flex items-center justify-center gap-2 text-sm font-medium transition hover:brightness-110"
              style={{ background: WECHAT_GREEN, color: '#ffffff' }}>
              <WeChatIcon className="w-5 h-5" color="#ffffff" />
              {zh ? '微信授权登录' : 'Continue with WeChat'}
            </button>

            {/* Sign up link */}
            <div className="mt-6" />
            <div className="text-center text-sm">
              <span className="text-gray-400">{zh ? '还没有账号？' : "Don't have an account?"}</span>
              {' '}
              <button className="text-cyan-400 hover:text-cyan-300 font-medium transition">
                {zh ? '立即注册' : 'Sign up'}
              </button>
            </div>
            </motion.div>
            )}
          </motion.div>

          {/* Security badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500"
          >
            <Shield className="w-3 h-3" />
            {zh ? '这是演示环境，请勿填写真实账号和密码，随意填写即可进入' : 'Demo only. Do not use a real account or password.'}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};
