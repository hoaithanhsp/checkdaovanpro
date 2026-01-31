import React, { useState } from 'react';
import { ShieldCheck, User, Lock, Eye, EyeOff, Sparkles } from 'lucide-react';
import { authenticateUser, saveLoginState, VIPAccount } from '../data/accounts';

interface LoginPageProps {
    onLoginSuccess: (user: VIPAccount) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        // Simulate loading
        await new Promise(resolve => setTimeout(resolve, 800));

        const account = authenticateUser(username, password);

        if (account) {
            saveLoginState(account);
            onLoginSuccess(account);
        } else {
            setError('Tên đăng nhập hoặc mật khẩu không đúng!');
        }

        setIsLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 relative overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full opacity-20 animate-pulse"></div>
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full opacity-10 animate-pulse" style={{ animationDelay: '2s' }}></div>

                {/* Floating particles */}
                {[...Array(20)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-2 h-2 bg-white rounded-full opacity-30 animate-bounce"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDuration: `${2 + Math.random() * 3}s`,
                            animationDelay: `${Math.random() * 2}s`
                        }}
                    />
                ))}
            </div>

            {/* Login Card */}
            <div className="relative z-10 w-full max-w-md">
                {/* Glass Card */}
                <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-8 text-center">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-2xl mb-4 backdrop-blur-sm">
                            <ShieldCheck size={40} className="text-white" />
                        </div>
                        <h1 className="text-3xl font-black text-white mb-2 tracking-tight">
                            <span className="bg-gradient-to-r from-yellow-200 via-pink-200 to-cyan-200 bg-clip-text text-transparent">
                                SKKN CHECKER PRO
                            </span>
                        </h1>
                        <p className="text-white/80 text-sm">
                            Đăng nhập để sử dụng hệ thống
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        {/* Username */}
                        <div className="space-y-2">
                            <label className="text-white/90 text-sm font-medium flex items-center gap-2">
                                <User size={16} />
                                Tên đăng nhập
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                placeholder="Nhập tên đăng nhập"
                                required
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <label className="text-white/90 text-sm font-medium flex items-center gap-2">
                                <Lock size={16} />
                                Mật khẩu
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all pr-12"
                                    placeholder="Nhập mật khẩu"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200 text-sm text-center">
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white font-bold rounded-xl hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 transform hover:scale-[1.02] transition-all shadow-lg shadow-purple-500/30 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Đang xác thực...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={20} />
                                    ĐĂNG NHẬP
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="px-8 pb-6 text-center">
                        <p className="text-white/40 text-xs">
                            © 2024 SKKN Checker Pro - Phát triển bởi thầy Trần Hoài Thanh
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
