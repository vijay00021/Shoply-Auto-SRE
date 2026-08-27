import React, { useState, useEffect } from 'react';
import { ShoppingBag, Search, User, Zap, Cpu, X, CreditCard, CheckCircle, LogOut, MapPin, Star } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import './Storefront.css';

const MOCK_PRODUCTS = [
  // Pet Products
  { id: 1, name: "Drools Focus Premium Dry Dog Food, 4kg", price: 1699, originalPrice: 1999, discount: "15% off", image: "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=500&q=80", category: "pets", rating: 4.3 },
  { id: 2, name: "Purepet Chicken and Veg Dry Cat Food, 7kg", price: 849, originalPrice: 1100, discount: "23% off", image: "https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=500&q=80", category: "pets", rating: 4.1 },
  { id: 3, name: "Drools Absolute Calcium Supplement, 110 Tabs", price: 349, originalPrice: 399, discount: "12% off", image: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=500&q=80", category: "pets", rating: 4.5 },
  { id: 4, name: "Pedigree Adult Wet Dog Food, Chicken, 30 Packs", price: 499, originalPrice: 600, discount: "16% off", image: "https://images.unsplash.com/photo-1544568100-847a948585b9?w=500&q=80", category: "pets", rating: 4.4 },
  { id: 5, name: "Whiskas Dry Cat Food, Ocean Fish, 3kg", price: 699, originalPrice: 850, discount: "17% off", image: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=500&q=80", category: "pets", rating: 4.2 },
  { id: 6, name: "Meat Up Calcium Bone Dog Supplement, 30pcs", price: 189, originalPrice: 299, discount: "36% off", image: "https://images.unsplash.com/photo-1569591159212-b02ea8a9f239?w=500&q=80", category: "pets", rating: 4.0 },
  
  // Bags & Backpacks
  { id: 7, name: "Skybags Brat Casual Backpack, 28L", price: 599, originalPrice: 1299, discount: "54% off", image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&q=80", category: "bags", rating: 4.2 },
  { id: 8, name: "Safari Quill Trendy Polyester 30L Backpack", price: 649, originalPrice: 1499, discount: "56% off", image: "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=500&q=80", category: "bags", rating: 4.0 },
  { id: 9, name: "American Tourister Fizz Casual Backpack", price: 699, originalPrice: 1600, discount: "56% off", image: "https://images.unsplash.com/photo-1581605405669-fcdf81165afa?w=500&q=80", category: "bags", rating: 4.4 },
  { id: 10, name: "Gear Classic Anti-Theft Laptop Backpack, 20L", price: 499, originalPrice: 1199, discount: "58% off", image: "https://images.unsplash.com/photo-1509281373149-e957c6296406?w=500&q=80", category: "bags", rating: 4.1 },
  { id: 11, name: "Wildcraft Work Backpack 44L Polyester", price: 1299, originalPrice: 2199, discount: "40% off", image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500&q=80", category: "bags", rating: 4.3 },
  { id: 12, name: "ADIDAS Unisex Classic Medium Backpack", price: 1499, originalPrice: 2499, discount: "40% off", image: "https://images.unsplash.com/photo-1531206715517-5c0ba140e2b8?w=500&q=80", category: "bags", rating: 4.5 },

  // Bluetooth Speakers
  { id: 13, name: "JBL Go 3 Portable Bluetooth Speaker", price: 2999, originalPrice: 3999, discount: "25% off", image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&q=80", category: "speakers", rating: 4.5 },
  { id: 14, name: "Echo Dot (5th Gen) Alexa Smart Speaker", price: 4499, originalPrice: 5499, discount: "18% off", image: "https://images.unsplash.com/photo-1543512214-318c7553f230?w=500&q=80", category: "speakers", rating: 4.3 },
  { id: 15, name: "boAt Stone 350 10W Wireless Speaker", price: 1499, originalPrice: 3490, discount: "57% off", image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&q=80", category: "speakers", rating: 4.2 },
  { id: 16, name: "Mivi Play Portable Wireless Speaker, 12H", price: 899, originalPrice: 1999, discount: "55% off", image: "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=500&q=80", category: "speakers", rating: 4.0 },
  { id: 17, name: "Sony SRS-XB100 Wireless Smart Speaker", price: 3999, originalPrice: 4990, discount: "20% off", image: "https://images.unsplash.com/photo-1563330232-57114bb0823c?w=500&q=80", category: "speakers", rating: 4.6 },
  { id: 18, name: "Marshall Willen Portable Speaker, Brass", price: 9999, originalPrice: 11999, discount: "16% off", image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80", category: "speakers", rating: 4.7 },

  // Printers & Routers
  { id: 19, name: "HP Ink Tank 315 Color All-in-One Printer", price: 11499, originalPrice: 13500, discount: "15% off", image: "https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=500&q=80", category: "printers", rating: 4.1 },
  { id: 20, name: "TP-Link AC1200 Archer Smart WiFi Router", price: 2299, originalPrice: 4999, discount: "54% off", image: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=500&q=80", category: "printers", rating: 4.3 },
  { id: 21, name: "Canon PIXMA MG2577S Color Inkjet Printer", price: 3299, originalPrice: 4200, discount: "21% off", image: "https://images.unsplash.com/photo-1563206767-5b18f218e8de?w=500&q=80", category: "printers", rating: 3.9 },
  { id: 22, name: "Netgear Nighthawk Smart Wi-Fi Router (R6700)", price: 4499, originalPrice: 8999, discount: "50% off", image: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=500&q=80", category: "printers", rating: 4.5 },
  { id: 23, name: "Epson EcoTank L3211 Color InkTank Printer", price: 11999, originalPrice: 14999, discount: "20% off", image: "https://images.unsplash.com/photo-1563206767-5b18f218e8de?w=500&q=80", category: "printers", rating: 4.3 },
  { id: 24, name: "D-Link DIR-615 Wireless N300 Router", price: 999, originalPrice: 1800, discount: "44% off", image: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=500&q=80", category: "printers", rating: 4.0 },

  // Smartphone Brands
  { id: 25, name: "OnePlus 12R (Iron Gray, 128GB Storage)", price: 39999, originalPrice: 42999, discount: "7% off", image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=500&q=80", category: "smartphones", rating: 4.6 },
  { id: 26, name: "Samsung Galaxy S24 Ultra 5G (Titanium Gray)", price: 129999, originalPrice: 144999, discount: "10% off", image: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500&q=80", category: "smartphones", rating: 4.7 },
  { id: 27, name: "Redmi Note 13 Pro 5G (Coral Purple)", price: 25999, originalPrice: 28999, discount: "10% off", image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&q=80", category: "smartphones", rating: 4.2 },
  { id: 28, name: "POCO X6 Pro 5G (8GB RAM, 256GB Storage)", price: 23999, originalPrice: 26999, discount: "11% off", image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=500&q=80", category: "smartphones", rating: 4.4 },
  { id: 29, name: "Realme GT 6T 5G (Fluid Silver, 128GB)", price: 30999, originalPrice: 33999, discount: "8% off", image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&q=80", category: "smartphones", rating: 4.3 },
  { id: 30, name: "iPhone 15 Pro Max (Natural Titanium, 256GB)", price: 144900, originalPrice: 159900, discount: "9% off", image: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500&q=80", category: "smartphones", rating: 4.8 },

  // Home Buys
  { id: 31, name: "Solimo Premium Double Bedsheet Set", price: 399, originalPrice: 999, discount: "60% off", image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=500&q=80", category: "home", rating: 4.0 },
  { id: 32, name: "Deco Wood Bedside Table Nightstand", price: 899, originalPrice: 1999, discount: "55% off", image: "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=500&q=80", category: "home", rating: 4.1 },
  { id: 33, name: "Cortina Blackout Curtains, Set of 2", price: 549, originalPrice: 1299, discount: "58% off", image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=500&q=80", category: "home", rating: 4.3 },
  { id: 34, name: "Wipro 12W Smart LED Light Bulb (B22)", price: 299, originalPrice: 799, discount: "62% off", image: "https://images.unsplash.com/photo-1565814636199-ae8133055c1c?w=500&q=80", category: "home", rating: 4.2 },
  { id: 35, name: "Kuber Industries Foldable Wardrobe Rack Organizer", price: 189, originalPrice: 399, discount: "52% off", image: "https://images.unsplash.com/photo-1558882224-cca166733360?w=500&q=80", category: "home", rating: 4.0 },
  { id: 36, name: "Story@Home Cotton Bath Towels Set of 4", price: 499, originalPrice: 999, discount: "50% off", image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=500&q=80", category: "home", rating: 4.1 }
];

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const Storefront = () => {
  const navigate = useNavigate();
  const [systemState, setSystemState] = useState('healthy');
  const [metrics, setMetrics] = useState(null);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState('cart'); // 'cart', 'checkout', 'processing', 'receipt'
  const [paymentStatus, setPaymentStatus] = useState(null); // 'success', 'failed'
  const [toastMessage, setToastMessage] = useState(null);
  
  // Auth State
  const [currentUser, setCurrentUser] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    // Check auto-login state
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
  }, []);
  
  // Continuously poll the python backend to detect AutoSRE anomalies and metrics
  useEffect(() => {
    const pollBackend = async () => {
      try {
        const [statusRes, metricsRes] = await Promise.all([
          fetch(`${API_BASE}/api/status`),
          fetch(`${API_BASE}/api/metrics`)
        ]);
        if (statusRes.ok) {
          const data = await statusRes.json();
          setSystemState(data.system_state);
        }
        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          setMetrics(metricsData);
        }
      } catch (error) {
        console.error("Backend unreachable.");
      }
    };

    const intervalId = setInterval(pollBackend, 1000);
    return () => clearInterval(intervalId);
  }, []);

  const isPaymentDown = metrics?.paymentservice?.error_rate > 50 || metrics?.checkoutservice?.error_rate > 30;
  const isFrontendDown = metrics?.frontend?.error_rate > 15;

  const addToCart = (product) => {
    setCart([...cart, product]);
    setToastMessage("Product is added to cart successfully");
    setTimeout(() => setToastMessage(null), 3000);
  };
  const decreaseCartQuantity = (product) => {
    const index = cart.findIndex(item => item.id === product.id);
    if (index !== -1) {
      const newCart = [...cart];
      newCart.splice(index, 1);
      setCart(newCart);
    }
  };
  const getProductQuantity = (product) => {
    return cart.filter(item => item.id === product.id).length;
  };
  const removeFromCart = (index) => setCart(cart.filter((_, i) => i !== index));
  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

  const handleCheckoutInitiation = () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    if (cart.length === 0) return;
    if (isPaymentDown) return; // Block checkout if service is down
    setCheckoutStep('checkout');
  };

  const handleCancelPayment = () => {
    setCheckoutStep('cart');
  };

  const handleProcessPayment = (e) => {
    e.preventDefault();
    setCheckoutStep('processing');
    
    // Simulate network delay for transaction processing
    setTimeout(() => {
      // Check system health at moment of processing
      const currentPaymentDown = metrics?.paymentservice?.error_rate > 50 || metrics?.checkoutservice?.error_rate > 30;
      
      if (currentPaymentDown) {
        setPaymentStatus('failed');
      } else {
        setPaymentStatus('success');
        setCart([]); // Clear cart on success
      }
      setCheckoutStep('receipt');
    }, 2500);
  };

  const closeCart = () => {
    setIsCartOpen(false);
    setTimeout(() => {
      setCheckoutStep('cart');
      setPaymentStatus(null);
    }, 300); // Reset state after modal closes
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
  };

  const scrollToSection = (e, id) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  };

  // Filter products by search & category dynamically
  const filteredProducts = MOCK_PRODUCTS.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="storefront-root">

      {/* Toast Notification */}
      <div className={`cart-toast ${toastMessage ? 'show' : ''}`}>
        {toastMessage}
      </div>

      {/* Cart & Checkout Modal */}
      {isCartOpen && (
        <div className="cart-modal-overlay" onClick={closeCart}>
          <div className="cart-modal animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="cart-header">
              <h2>{checkoutStep === 'checkout' ? 'Secure Checkout' : checkoutStep === 'receipt' ? 'Order Status' : checkoutStep === 'processing' ? 'Processing' : 'Your Cart'}</h2>
              <button className="close-btn" onClick={closeCart}><X size={24} /></button>
            </div>

            {checkoutStep === 'cart' && (
              <>
                <div className={`cart-items ${isPaymentDown ? 'glitch-container partial-crash-overlay' : ''}`}>
                  {isPaymentDown && (
                    <div className="glitch-overlay-text">
                      <Zap size={32} color="#DC2626"/>
                      <span>CART SERVICE UNSTABLE</span>
                    </div>
                  )}
                  {cart.length === 0 ? (
                    <p className="empty-cart">Your cart is empty.</p>
                  ) : (
                    cart.map((item, index) => (
                      <div key={index} className="cart-item">
                        <img src={item.image} alt={item.name} />
                        <div className="cart-item-info">
                          <h4>{item.name}</h4>
                          <p>₹{item.price}</p>
                        </div>
                        <button className="remove-btn" onClick={() => removeFromCart(index)}>
                          <X size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                
                <div className={`cart-footer ${isPaymentDown ? 'glitch-container partial-crash-overlay' : ''}`}>
                  {isPaymentDown && (
                    <div className="glitch-overlay-text" style={{fontSize: '0.9rem', flexDirection: 'row'}}>
                      <Zap size={18} color="#DC2626"/>
                      <span>CHECKOUT UNAVAILABLE</span>
                    </div>
                  )}
                  <div className="cart-total">
                    <span>Total:</span>
                    <span>₹{cartTotal}</span>
                  </div>
                  <button 
                    className={`checkout-btn ${isPaymentDown ? 'disabled-glitch' : ''}`} 
                    onClick={handleCheckoutInitiation}
                    disabled={cart.length === 0 || isPaymentDown}
                  >
                    Proceed to Checkout <CheckCircle size={18} />
                  </button>
                </div>
              </>
            )}

            {checkoutStep === 'checkout' && (
              <form className="checkout-form animate-fade-in" onSubmit={handleProcessPayment}>
                <div className="form-section">
                  <h3>Shipping Details</h3>
                  <input type="text" placeholder="Full Name" required defaultValue={currentUser?.name || ''} />
                  <input type="text" placeholder="Address" required defaultValue="1600 Amphitheatre Pkwy" />
                  <div className="form-row">
                    <input type="text" placeholder="City" required defaultValue="Mountain View" />
                    <input type="text" placeholder="ZIP" required defaultValue="94043" />
                  </div>
                </div>

                <div className="form-section">
                  <h3>Payment Method</h3>
                  <div className="mock-card">
                    <div className="card-chip"></div>
                    <input type="text" className="card-number" placeholder="0000 0000 0000 0000" required maxLength="19" defaultValue="4111 1111 1111 1111" />
                    <div className="card-details">
                      <input type="text" placeholder="MM/YY" required maxLength="5" defaultValue="12/28" />
                      <input type="password" placeholder="CVV" required maxLength="4" defaultValue="123" />
                    </div>
                  </div>
                </div>

                <div className="checkout-actions">
                  <div className="checkout-total">To Pay: <b>₹{cartTotal}</b></div>
                  <div className="action-buttons">
                    <button type="button" className="cancel-btn" onClick={handleCancelPayment}>Cancel</button>
                    <button type="submit" className="pay-btn">Pay Now <CheckCircle size={16} /></button>
                  </div>
                </div>
              </form>
            )}

            {checkoutStep === 'processing' && (
              <div className="processing-state animate-fade-in">
                <div className="spinner"></div>
                <h3>Processing Transaction...</h3>
                <p>Please do not close this window.</p>
                <div className="secure-badge"><Cpu size={14}/> Secure connection to Payment Gateway</div>
              </div>
            )}

            {checkoutStep === 'receipt' && (
              <div className={`receipt-state animate-fade-in ${paymentStatus}`}>
                {paymentStatus === 'success' ? (
                  <>
                    <CheckCircle size={64} color="#16A34A" className="receipt-icon pulse" />
                    <h2>Payment Successful!</h2>
                    <p>Thank you for your order.</p>
                    <div className="order-details">
                      <span>Order ID: #{Math.floor(Math.random() * 900000) + 100000}</span>
                      <span>Amount Paid: ₹{cartTotal}</span>
                    </div>
                    <button className="continue-shopping-btn" onClick={closeCart}>Continue Shopping</button>
                  </>
                ) : (
                  <>
                    <Zap size={64} color="#DC2626" className="receipt-icon shake" />
                    <h2>Transaction Failed</h2>
                    <p>Microservice Error (503): Payment Gateway Offline or Timed Out. Please try again later.</p>
                    <div className="action-buttons" style={{marginTop: '2rem', width: '100%', justifyContent: 'center'}}>
                      <button className="cancel-btn" onClick={handleCancelPayment} style={{width: 'auto'}}>Return to Checkout</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shoply Header Bar 1: Top Bar */}
      <header className="shoply-top-bar">
        <div className="shoply-logo-container" onClick={() => navigate('/')}>
          <span className="shoply-logo-text">Shoply</span>
          <span className="shoply-logo-in">.in</span>
        </div>

        <div className="shoply-delivery-location">
          <MapPin size={18} className="location-icon" />
          <div className="location-text">
            <span className="location-line1">Delivering to Ahmedabad 380059</span>
            <span className="location-line2">Update location</span>
          </div>
        </div>

        <div className="amazon-search-bar">
          <select 
            className="search-category-select" 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="pets">Pet Supplies</option>
            <option value="bags">Bags & Backpacks</option>
            <option value="speakers">Speakers</option>
            <option value="printers">Printers & Routers</option>
            <option value="smartphones">Smartphones</option>
            <option value="home">Home & Kitchen</option>
          </select>
          <input 
            type="text" 
            placeholder="Search Shoply.in" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)} 
          />
          <button className="search-submit-btn">
            <Search size={20} />
          </button>
        </div>

        <div className="shoply-language-picker">
          <span className="flag-icon">🇮🇳</span>
          <span className="lang-text">EN</span>
          <span className="arrow-down">▼</span>
        </div>

        <div className="shoply-account-nav" onClick={() => !currentUser && navigate('/login')}>
          <span className="nav-line1">Hello, {currentUser ? currentUser.name : 'sign in'}</span>
          <span className="nav-line2">Account & Lists <span className="arrow-down">▼</span></span>
          
          {/* Account Dropdown Menu */}
          <div className="account-dropdown-menu" onClick={(e) => e.stopPropagation()}>
            {!currentUser ? (
              <div className="dropdown-signin-box">
                <button className="dropdown-signin-btn" onClick={() => navigate('/login')}>Sign in</button>
                <span className="dropdown-new-cust">New customer? <span className="dropdown-start-here" onClick={() => navigate('/login')}>Start here.</span></span>
              </div>
            ) : (
              <div className="dropdown-signin-box">
                <span className="dropdown-welcome">Welcome, <b>{currentUser.name}</b></span>
                <button className="dropdown-signout-btn" onClick={handleLogout}>Sign Out</button>
              </div>
            )}
            <div className="dropdown-columns">
              <div className="dropdown-column">
                <h3>Your Lists</h3>
                <ul>
                  <li>Create a Wish List</li>
                  <li>Wish from Any Website</li>
                  <li>Baby Wishlist</li>
                  <li>Discover Your Style</li>
                  <li>Explore Showroom</li>
                </ul>
              </div>
              <div className="dropdown-divider"></div>
              <div className="dropdown-column">
                <h3>Your Account</h3>
                <ul>
                  <li>Your Account</li>
                  <li>Your Orders</li>
                  <li>Your Wish List</li>
                  <li>Keep shopping for</li>
                  <li>Your Recommendations</li>
                  <li>Your Prime Membership</li>
                  <li>Your Prime Video</li>
                  <li>Your Subscribe & Save Items</li>
                  <li>Memberships & Subscriptions</li>
                  <li>Your Seller Account</li>
                  <li>Manage Your Content and Devices</li>
                  <li>Your Music Library</li>
                  <li>Register for a free Business Account</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="shoply-orders-nav">
          <span className="nav-line1">Returns</span>
          <span className="nav-line2">& Orders</span>
        </div>

        <div className="shoply-cart-nav" onClick={() => setIsCartOpen(true)}>
          <div className="cart-icon-wrapper">
            <ShoppingBag size={24} />
            <span className="cart-count">{cart.length}</span>
          </div>
          <span className="cart-label">Cart</span>
        </div>
      </header>

      {/* Shoply Header Bar 2: Second Nav Bar */}
      <nav className="shoply-second-nav">
        <div className="nav-menu-all">
          <span className="menu-icon">☰</span>
          <span className="menu-text">All</span>
        </div>
        <div className="second-nav-links">
          <span onClick={() => setSelectedCategory('all')}>Fresh</span>
          <span onClick={() => setSelectedCategory('all')}>Prime Video</span>
          <span onClick={() => setSelectedCategory('all')}>Sell</span>
          <span onClick={() => setSelectedCategory('all')}>Bestsellers</span>
          <span onClick={() => setSelectedCategory('all')}>Today's Deals</span>
          <span onClick={() => setSelectedCategory('all')}>Customer Service</span>
          <span onClick={() => setSelectedCategory('smartphones')}>Mobiles</span>
          <span onClick={() => setSelectedCategory('all')}>New Releases</span>
          <span onClick={() => setSelectedCategory('all')}>Prime</span>
          <span onClick={() => setSelectedCategory('all')}>Shoply Pay</span>
          <span onClick={() => setSelectedCategory('all')}>Electronics</span>
          <span onClick={() => setSelectedCategory('home')}>Home & Kitchen</span>
          <span onClick={() => setSelectedCategory('all')}>Fashion</span>
          <span onClick={() => setSelectedCategory('all')}>Computers</span>
          <span onClick={() => setSelectedCategory('all')}>Beauty & Personal Care</span>
        </div>
      </nav>

      <main className="store-main">
        {isFrontendDown && (
          <div className="partial-crash-overlay" style={{borderRadius: '0'}}>
            <div className="glitch-container">
              <h1 className="glitch" data-text="503">503</h1>
              <h2>FRONTEND OVERLOADED</h2>
              <p className="crash-message">Product Catalog & UI components failing to load due to traffic spike.</p>
              <div className="system-recovery-loader">
                <span className="load-pulse"></span> Auto-scaling...
              </div>
            </div>
          </div>
        )}

        {searchQuery || selectedCategory !== 'all' ? (
          /* Search / Filter Results View */
          <section className="search-results-section">
            <h2>Results {searchQuery && `for "${searchQuery}"`} {selectedCategory !== 'all' && `in ${selectedCategory.toUpperCase()}`}</h2>
            {filteredProducts.length === 0 ? (
              <p className="no-results">No products found matching your criteria.</p>
            ) : (
              <div className="product-grid">
                {filteredProducts.map(product => (
                  <div key={product.id} className="product-card">
                    <div className="product-image" style={{ backgroundImage: `url(${product.image})` }}>
                      {product.discount && <span className="product-tag">{product.discount}</span>}
                    </div>
                    <div className="product-info">
                      <h3>{product.name}</h3>
                      <div className="rating-row">
                        <span className="stars">{"★".repeat(Math.floor(product.rating)) + (product.rating % 1 >= 0.5 ? "½" : "")}</span>
                        <span className="rating-val">{product.rating}</span>
                      </div>
                      <div className="product-bottom">
                        <div className="price-wrapper">
                          <span className="price">₹{product.price}</span>
                          <span className="original-price">M.R.P: ₹{product.originalPrice}</span>
                        </div>
                        {getProductQuantity(product) > 0 ? (
                          <div className="qty-selector-container">
                            <button className="qty-btn minus" onClick={() => decreaseCartQuantity(product)}>-</button>
                            <span className="qty-val">{getProductQuantity(product)}</span>
                            <button className="qty-btn plus" onClick={() => addToCart(product)}>+</button>
                          </div>
                        ) : (
                          <button className="add-btn" onClick={() => addToCart(product)}>Add to Cart</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          /* Main Amazon Homepage View */
          <>
            {/* Hero Section with Banner & Teaser Cards */}
            <section className="shoply-hero-section">
              <div className="shoply-hero-banner">
                <div className="banner-content">
                  <span className="banner-badge">bazaar</span>
                  <h1>Lowest prices on Shoply</h1>
                  <p>Fashion, home & more | Free Delivery</p>
                </div>
                <div className="banner-graphic">
                  <div className="target-icon-ring">
                    <div className="target-bullseye"></div>
                  </div>
                </div>
              </div>

              <div className="shoply-hero-grid">
                {/* Card 1: Pet products */}
                <div className="teaser-card">
                  <h3>Starting ₹149 | Pet products</h3>
                  <div className="teaser-images-2x2">
                    <div className="teaser-img-box" onClick={() => setSelectedCategory('pets')}>
                      <img src="https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=300&q=80" alt="Dog Food" />
                      <span>Dog Food</span>
                    </div>
                    <div className="teaser-img-box" onClick={() => setSelectedCategory('pets')}>
                      <img src="https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=300&q=80" alt="Cat Food" />
                      <span>Cat Food</span>
                    </div>
                  </div>
                  <span className="see-more-link" onClick={() => setSelectedCategory('pets')}>See all pet products</span>
                </div>

                {/* Card 2: FunZone Wheel */}
                <div className="teaser-card funzone-card">
                  <h3>Win up to ₹300 back</h3>
                  <p className="card-sub">Spin the wheel & win rewards daily</p>
                  <div className="funzone-wheel-container">
                    <div className="funzone-wheel">
                      <div className="wheel-spin-btn">SPIN</div>
                    </div>
                    <div className="funzone-pointer"></div>
                  </div>
                  <span className="see-more-link">Play now</span>
                </div>

                {/* Card 3: Bags & Backpacks */}
                <div className="teaser-card">
                  <h3>Under ₹699 | Bags & backpacks</h3>
                  <div className="teaser-images-2x2">
                    <div className="teaser-img-box" onClick={() => setSelectedCategory('bags')}>
                      <img src="https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300&q=80" alt="Casual Bags" />
                      <span>Skybags</span>
                    </div>
                    <div className="teaser-img-box" onClick={() => setSelectedCategory('bags')}>
                      <img src="https://images.unsplash.com/photo-1581605405669-fcdf81165afa?w=300&q=80" alt="Travel Bags" />
                      <span>Travel Bags</span>
                    </div>
                  </div>
                  <span className="see-more-link" onClick={() => setSelectedCategory('bags')}>See all bags</span>
                </div>

                {/* Card 4: Shop popular deals */}
                <div className="teaser-card">
                  <h3>Shop popular deals</h3>
                  <div className="teaser-images-2x2">
                    <div className="teaser-img-box" onClick={() => setSelectedCategory('home')}>
                      <img src="https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=300&q=80" alt="Bedsheet" />
                      <span className="deal-pct">60% off</span>
                    </div>
                    <div className="teaser-img-box" onClick={() => setSelectedCategory('speakers')}>
                      <img src="https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=300&q=80" alt="Speaker" />
                      <span className="deal-pct">25% off</span>
                    </div>
                  </div>
                  <span className="see-more-link">Shop all deals</span>
                </div>
              </div>
            </section>

            {/* Category Row 1: Pet Products */}
            <section className="shoply-row-section" id="pets">
              <h2>Starting ₹149 | Top picks for your pet</h2>
              <div className="product-row-grid">
                {MOCK_PRODUCTS.filter(p => p.category === 'pets').map(product => (
                  <div key={product.id} className="row-product-card">
                    <img src={product.image} alt={product.name} />
                    <h4>{product.name}</h4>
                    <div className="rating-row">
                      <span className="stars">{"★".repeat(Math.floor(product.rating)) + (product.rating % 1 >= 0.5 ? "½" : "")}</span>
                      <span className="rating-val">{product.rating}</span>
                    </div>
                    <div className="row-product-bottom">
                      <div className="price-tag">₹{product.price}</div>
                      {getProductQuantity(product) > 0 ? (
                        <div className="qty-selector-container">
                          <button className="qty-btn minus" onClick={() => decreaseCartQuantity(product)}>-</button>
                          <span className="qty-val">{getProductQuantity(product)}</span>
                          <button className="qty-btn plus" onClick={() => addToCart(product)}>+</button>
                        </div>
                      ) : (
                        <button className="add-btn" onClick={() => addToCart(product)}>Add to Cart</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Category Row 2: Bags & Backpacks */}
            <section className="shoply-row-section" id="bags">
              <h2>Under ₹699 | Trending backpacks</h2>
              <div className="product-row-grid">
                {MOCK_PRODUCTS.filter(p => p.category === 'bags').map(product => (
                  <div key={product.id} className="row-product-card">
                    <img src={product.image} alt={product.name} />
                    <h4>{product.name}</h4>
                    <div className="rating-row">
                      <span className="stars">{"★".repeat(Math.floor(product.rating)) + (product.rating % 1 >= 0.5 ? "½" : "")}</span>
                      <span className="rating-val">{product.rating}</span>
                    </div>
                    <div className="row-product-bottom">
                      <div className="price-tag">₹{product.price}</div>
                      {getProductQuantity(product) > 0 ? (
                        <div className="qty-selector-container">
                          <button className="qty-btn minus" onClick={() => decreaseCartQuantity(product)}>-</button>
                          <span className="qty-val">{getProductQuantity(product)}</span>
                          <button className="qty-btn plus" onClick={() => addToCart(product)}>+</button>
                        </div>
                      ) : (
                        <button className="add-btn" onClick={() => addToCart(product)}>Add to Cart</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Category Row 3: Bluetooth Speakers */}
            <section className="shoply-row-section" id="speakers">
              <h2>Deals on Bluetooth speakers for your home</h2>
              <div className="product-row-grid">
                {MOCK_PRODUCTS.filter(p => p.category === 'speakers').map(product => (
                  <div key={product.id} className="row-product-card">
                    <img src={product.image} alt={product.name} />
                    <h4>{product.name}</h4>
                    <div className="rating-row">
                      <span className="stars">{"★".repeat(Math.floor(product.rating)) + (product.rating % 1 >= 0.5 ? "½" : "")}</span>
                      <span className="rating-val">{product.rating}</span>
                    </div>
                    <div className="row-product-bottom">
                      <div className="price-tag">₹{product.price}</div>
                      {getProductQuantity(product) > 0 ? (
                        <div className="qty-selector-container">
                          <button className="qty-btn minus" onClick={() => decreaseCartQuantity(product)}>-</button>
                          <span className="qty-val">{getProductQuantity(product)}</span>
                          <button className="qty-btn plus" onClick={() => addToCart(product)}>+</button>
                        </div>
                      ) : (
                        <button className="add-btn" onClick={() => addToCart(product)}>Add to Cart</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Category Row 4: Printers & Routers */}
            <section className="shoply-row-section" id="printers">
              <h2>Up to 60% off | Bestselling Printers & routers</h2>
              <div className="product-row-grid">
                {MOCK_PRODUCTS.filter(p => p.category === 'printers').map(product => (
                  <div key={product.id} className="row-product-card">
                    <img src={product.image} alt={product.name} />
                    <h4>{product.name}</h4>
                    <div className="rating-row">
                      <span className="stars">{"★".repeat(Math.floor(product.rating)) + (product.rating % 1 >= 0.5 ? "½" : "")}</span>
                      <span className="rating-val">{product.rating}</span>
                    </div>
                    <div className="row-product-bottom">
                      <div className="price-tag">₹{product.price}</div>
                      {getProductQuantity(product) > 0 ? (
                        <div className="qty-selector-container">
                          <button className="qty-btn minus" onClick={() => decreaseCartQuantity(product)}>-</button>
                          <span className="qty-val">{getProductQuantity(product)}</span>
                          <button className="qty-btn plus" onClick={() => addToCart(product)}>+</button>
                        </div>
                      ) : (
                        <button className="add-btn" onClick={() => addToCart(product)}>Add to Cart</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Category Row 5: Smartphones */}
            <section className="shoply-row-section" id="smartphones">
              <h2>Get up to 40% off on top smartphone brands</h2>
              <div className="product-row-grid">
                {MOCK_PRODUCTS.filter(p => p.category === 'smartphones').map(product => (
                  <div key={product.id} className="row-product-card">
                    <img src={product.image} alt={product.name} />
                    <h4>{product.name}</h4>
                    <div className="rating-row">
                      <span className="stars">{"★".repeat(Math.floor(product.rating)) + (product.rating % 1 >= 0.5 ? "½" : "")}</span>
                      <span className="rating-val">{product.rating}</span>
                    </div>
                    <div className="row-product-bottom">
                      <div className="price-tag">₹{product.price}</div>
                      {getProductQuantity(product) > 0 ? (
                        <div className="qty-selector-container">
                          <button className="qty-btn minus" onClick={() => decreaseCartQuantity(product)}>-</button>
                          <span className="qty-val">{getProductQuantity(product)}</span>
                          <button className="qty-btn plus" onClick={() => addToCart(product)}>+</button>
                        </div>
                      ) : (
                        <button className="add-btn" onClick={() => addToCart(product)}>Add to Cart</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Category Row 6: Home Buys */}
            <section className="shoply-row-section" id="home">
              <h2>Starting ₹169 | Must-have home buys</h2>
              <div className="product-row-grid">
                {MOCK_PRODUCTS.filter(p => p.category === 'home').map(product => (
                  <div key={product.id} className="row-product-card">
                    <img src={product.image} alt={product.name} />
                    <h4>{product.name}</h4>
                    <div className="rating-row">
                      <span className="stars">{"★".repeat(Math.floor(product.rating)) + (product.rating % 1 >= 0.5 ? "½" : "")}</span>
                      <span className="rating-val">{product.rating}</span>
                    </div>
                    <div className="row-product-bottom">
                      <div className="price-tag">₹{product.price}</div>
                      {getProductQuantity(product) > 0 ? (
                        <div className="qty-selector-container">
                          <button className="qty-btn minus" onClick={() => decreaseCartQuantity(product)}>-</button>
                          <span className="qty-val">{getProductQuantity(product)}</span>
                          <button className="qty-btn plus" onClick={() => addToCart(product)}>+</button>
                        </div>
                      ) : (
                        <button className="add-btn" onClick={() => addToCart(product)}>Add to Cart</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
      
      <footer className="store-footer">
        <p>&copy; 2026 TechnoGear Inc. All systems monitored by AutoSRE.</p>
      </footer>
    </div>
  );
};

export default Storefront;
