interface Draft3v3v3Props {
  onBackToMenu: () => void;
}

export default function Draft3v3v3({ onBackToMenu }: Draft3v3v3Props) {
  return (
    <div className="h-screen bg-linear-to-br from-gray-950 to-gray-900 flex items-center justify-center px-6">
      <div className="bg-gray-800 rounded-xl shadow-2xl p-12 border-2 border-gray-700 max-w-2xl w-full text-center">
        <div className="text-8xl font-bold text-purple-500 mb-6">3v3v3</div>
        <h1 className="text-4xl font-bold text-gray-100 mb-4">Coming Soon</h1>
        <p className="text-gray-400 text-lg mb-8">
          The 3v3v3 draft format is currently under development.
          <br />
        </p>
        <button
          onClick={onBackToMenu}
          className="bg-gray-700 hover:bg-gray-600 text-gray-100 font-bold py-3 px-8 rounded-lg transition-colors border border-gray-600"
        >
          ← Back to Format Selection
        </button>
      </div>
    </div>
  );
}
