const { createApp } = Vue;

const app = createApp({
    el: "#app",
    data() {
        console.log('Initializing Vue data...');
        return {
            isAuthenticated: false,
            currentPage: 'signup',
            currentView: 'browse-all',
            isLoading: false,
            preferencesChanged: false,
            selectedCategories: [],
            itinerary: [],
            error: null,
            signupError: '',
            loginError: '',
            currentUserEmail: '',

            // Login Form Data
            loginForm: {
                email: '',
                password: ''
            },

            // Signup Form Data
            signupForm: {
                fullName: '',
                email: '',
                password: '',
                confirmPassword: '',
                destinationCity: ''
            },
            userCategories: [],
            cities: [
                'Abu Dhabi',
                'Dubai',
                'Sharjah',
                'Ajman',
                'Ras Al Khaimah',
                'Al Ain',
                'Fujairah'
            ],
            preferences: [
                'Religious', 'Architecture', 'History', 'Cultural', 'Museum',
                'Heritage', 'Art', 'Nature', 'Oasis', 'Agriculture',
                'Fort', 'Mountain', 'Archaeology', 'Traditional', 'Desert',
                'Performing', 'Entertainment', 'International', 'Craftsmanship', 'Trade',
                'Maritime', 'Market', 'Jewellery', 'Culinary', 'Education',
                'Shopping', 'Leisure', 'Family', 'Canal', 'Walk',
                'Calligraphy', 'Restoration', 'Wildlife', 'Sheikh Zayed', 'Conservation',
                'Adventure', 'Motor', 'National', 'UAE', 'Formation',
                'Technology', 'Camel', 'Racing', 'Sports', 'Landmark',
                'Modern', 'Bird', 'Watching', 'Festival', 'Eco-Tourism',
                'Biodome', 'Experience', 'UNESCO', 'Sheikh Khalifa'
            ],

            // Main App Data
            searchQuery: "",
            showItinerary: false,
            experiences: [],
            apiBaseUrl: 'https://smart-tourism-jgps.onrender.com/api',
            baseUrl: 'https://smart-tourism-jgps.onrender.com',
            sortBy: '',
            sortOrder: 'asc', // 'asc' or 'desc'
            showAllCities: true,
            userData: null,
            draggedIndex: null,

            // Review Modal Data
            showReviewPopup: false,
            showReviewForm: false,
            currentReviewSpot: null,
            reviewForm: {
                rating: 0,
                comment: ''
            },
            showReviewsModal: false,
            currentReviewsSpot: null,
            spotReviews: [],
            reviewsSortBy: 'date',
            reviewsSortOrder: 'desc',
        }
    },
    created() {
        console.log('Vue instance created');
        console.log('Current review modal state:', {
            showReviewPopup: this.showReviewPopup,
            showReviewForm: this.showReviewForm,
            currentReviewSpot: this.currentReviewSpot
        });

        // Check if user is already logged in
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                console.log('Found stored user:', user);
                this.isAuthenticated = true;
                this.currentUserEmail = user.email;
                this.userCategories = user.preferences || [];
                this.fetchItinerary();
            } catch (error) {
                console.error('Error parsing stored user:', error);
                localStorage.removeItem('currentUser');
            }
        }

        // Fetch all spots when the app is created
        this.fetchSpots();
    },
    watch: {
        experiences: {
            handler(newVal) {
                console.log('Experiences updated:', newVal);
            },
            deep: true
        },
        currentView: {
            handler(newView) {
                console.log('View changed to:', newView);
                if (newView === 'browse-recommended') {
                    this.fetchRecommendedSpots();
                } else if (newView === 'browse-all') {
                    this.fetchSpots();
                }
            },
            immediate: true
        }
    },
    computed: {
        filteredExperiences() {
            let filtered = this.experiences;

            // Apply search filter
            if (this.searchQuery) {
                const query = this.searchQuery.toLowerCase();
                filtered = filtered.filter(experience =>
                    experience.title.toLowerCase().includes(query) ||
                    experience.description.toLowerCase().includes(query) ||
                    experience.category.some(cat => cat.toLowerCase().includes(query))
                );
            }

            // Apply destination city filter if not showing all cities
            if (!this.showAllCities && this.currentUserEmail) {
                const userCity = this.userData?.destinationCity;
                if (userCity) {
                    filtered = filtered.filter(experience =>
                        experience.location.city === userCity
                    );
                }
            }

            // Apply sorting
            if (this.sortBy) {
                filtered.sort((a, b) => {
                    let valueA, valueB;

                    switch (this.sortBy) {
                        case 'title':
                            valueA = a.title.toLowerCase();
                            valueB = b.title.toLowerCase();
                            break;
                        case 'price':
                            valueA = a.price || 0;
                            valueB = b.price || 0;
                            break;
                        case 'rating':
                            valueA = a.googleReviews.rating || 0;
                            valueB = b.googleReviews.rating || 0;
                            break;
                        case 'reviewCount':
                            valueA = a.googleReviews.reviewCount || 0;
                            valueB = b.googleReviews.reviewCount || 0;
                            break;
                        default:
                            return 0;
                    }

                    if (this.sortOrder === 'asc') {
                        return valueA > valueB ? 1 : -1;
                    } else {
                        return valueA < valueB ? 1 : -1;
                    }
                });
            }

            return filtered;
        },
        sortedReviews() {
            return [...this.spotReviews].sort((a, b) => {
                let valueA, valueB;

                if (this.reviewsSortBy === 'date') {
                    valueA = new Date(a.createdAt.split('/').reverse().join('-'));
                    valueB = new Date(b.createdAt.split('/').reverse().join('-'));
                } else {
                    valueA = a.rating;
                    valueB = b.rating;
                }

                return this.reviewsSortOrder === 'asc' ? valueA - valueB : valueB - valueA;
            });
        }
    },
    methods: {
        getImageUrl(imagePath) {
            if (!imagePath) return `${this.baseUrl}/images/default.jpg`;
            if (imagePath.startsWith('http')) return imagePath;
            return `${this.baseUrl}/images/${imagePath}`;
        },
        async makeRequest(url, method = 'GET', data = null) {
            try {
                const options = {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    credentials: 'include',
                    mode: 'cors'
                };

                if (data) {
                    options.body = JSON.stringify(data);
                }

                console.log(`Making ${method} request to ${url}`);
                const response = await fetch(url, options);
                console.log('Response status:', response.status);
                console.log('Response headers:', Object.fromEntries(response.headers.entries()));

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('API Response:', errorData);
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }

                const responseData = await response.json();
                console.log('API Response:', responseData);
                return responseData;
            } catch (error) {
                console.error('API request error:', error);
                throw error;
            }
        },

        async fetchSpots() {
            try {
                this.isLoading = true;
                this.error = null;
                const response = await this.makeRequest(`${this.apiBaseUrl}/spots`);
                this.experiences = response.data.map(spot => ({
                    ...spot,
                    image: this.getImageUrl(spot.image)
                }));
            } catch (error) {
                console.error('Error in fetchSpots:', error);
                this.error = 'Failed to load spots. Please try again later.';
                this.experiences = [];
            } finally {
                this.isLoading = false;
            }
        },

        async fetchRecommendedSpots() {
            try {
                this.isLoading = true;
                this.error = null;

                console.log('Starting fetchRecommendedSpots...');
                console.log('Current user email:', this.currentUserEmail);

                if (!this.currentUserEmail) {
                    throw new Error('No user email found. Please log in first.');
                }

                // First, get the user's destination city and preferences
                console.log('Fetching user data...');
                const userResponse = await this.makeRequest(`${this.apiBaseUrl}/users/${this.currentUserEmail}`);
                console.log('User response:', userResponse);

                if (!userResponse.success) {
                    throw new Error(`Failed to fetch user data: ${userResponse.message}`);
                }

                this.userData = userResponse.data;
                console.log('User data:', this.userData);

                if (!this.userData) {
                    throw new Error('User data is empty');
                }

                if (!this.userData.destinationCity) {
                    throw new Error('User destination city not found');
                }

                if (!this.userData.preferences || !Array.isArray(this.userData.preferences) || this.userData.preferences.length === 0) {
                    throw new Error('User preferences not found or empty');
                }

                // Fetch all spots
                console.log('Fetching all spots...');
                const spotsResponse = await this.makeRequest(`${this.apiBaseUrl}/spots`);
                console.log('Spots response:', spotsResponse);

                const allSpots = spotsResponse.data || [];
                console.log('Total spots found:', allSpots.length);

                // Filter spots based on preferences
                const recommendedSpots = allSpots.filter(spot => {
                    const hasPreferredCategory = spot.category.some(category =>
                        this.userData.preferences.includes(category)
                    );

                    console.log('Spot:', spot.title);
                    console.log('Category match:', hasPreferredCategory, 'Spot categories:', spot.category);

                    return hasPreferredCategory;
                });

                console.log('Filtered spots:', recommendedSpots.length);
                console.log('Recommended spots:', recommendedSpots);

                if (recommendedSpots.length === 0) {
                    console.warn('No spots matched the criteria');
                    this.error = 'No spots found matching your preferences.';
                }

                this.experiences = recommendedSpots;
            } catch (error) {
                console.error('Error in fetchRecommendedSpots:', error);
                console.error('Error stack:', error.stack);
                this.error = error.message || 'Failed to load recommended spots. Please try again later.';
                this.experiences = [];
            } finally {
                this.isLoading = false;
            }
        },

        async searchSpots(query) {
            try {
                this.isLoading = true;
                this.error = null;
                const response = await this.makeRequest(`${this.apiBaseUrl}/spots/search?query=${encodeURIComponent(query)}`);
                this.experiences = response.data;
            } catch (error) {
                this.experiences = [];
            } finally {
                this.isLoading = false;
            }
        },

        validateEmail(emailId) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(emailId);
        },

        validatePassword(password) {
            const minLength = 8;
            const hasUpperCase = /[A-Z]/.test(password);
            const hasLowerCase = /[a-z]/.test(password);
            const hasNumbers = /\d/.test(password);
            const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

            if (password.length < minLength) {
                return 'Password must be at least 8 characters long';
            }
            if (!hasUpperCase) {
                return 'Password must contain at least one uppercase letter';
            }
            if (!hasLowerCase) {
                return 'Password must contain at least one lowercase letter';
            }
            if (!hasNumbers) {
                return 'Password must contain at least one number';
            }
            if (!hasSpecialChar) {
                return 'Password must contain at least one special character';
            }
            return null;
        },

        validateForm() {
            if (!this.signupForm.fullName.trim()) {
                this.signupError = 'Please enter your full name';
                return false;
            }

            if (!this.validateEmail(this.signupForm.email)) {
                this.signupError = 'Please enter a valid email address';
                return false;
            }

            const passwordError = this.validatePassword(this.signupForm.password);
            if (passwordError) {
                this.signupError = passwordError;
                return false;
            }

            if (this.signupForm.password !== this.signupForm.confirmPassword) {
                this.signupError = 'Passwords do not match';
                return false;
            }

            if (!this.signupForm.destinationCity) {
                this.signupError = 'Please select a destination city';
                return false;
            }

            if (this.selectedCategories.length === 0) {
                this.signupError = 'Please select at least one category';
                return false;
            }

            return true;
        },

        handleLogin() {
            this.loginError = '';
            const errors = [];

            console.log('Login attempt with email:', this.loginForm.email);
            console.log('Login form data:', this.loginForm);

            // Validate email
            if (!this.loginForm.email || this.loginForm.email.trim() === '') {
                errors.push('Email is required');
            } else if (!this.validateEmail(this.loginForm.email)) {
                errors.push('Please enter a valid email address');
            }

            // Validate password
            if (!this.loginForm.password || this.loginForm.password.trim() === '') {
                errors.push('Password is required');
            }

            if (errors.length > 0) {
                this.loginError = errors.join('. ');
                console.log('Login validation errors:', errors);
                return;
            }

            this.isLoading = true;

            // Send login request to server
            fetch(`${this.apiBaseUrl}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: this.loginForm.email,
                    password: this.loginForm.password
                })
            })
                .then(response => {
                    console.log('Login response status:', response.status);
                    if (!response.ok) {
                        return response.json().then(data => {
                            throw new Error(data.message || 'Login failed');
                        });
                    }
                    return response.json();
                })
                .then(async data => {
                    console.log('Login successful:', data);
                    this.isAuthenticated = true;
                    this.currentUserEmail = this.loginForm.email;
                    this.userCategories = data.user.preferences || [];

                    // Fetch user data immediately after login
                    try {
                        const userResponse = await this.makeRequest(`${this.apiBaseUrl}/users/${this.currentUserEmail}`);
                        if (userResponse.success) {
                            this.userData = userResponse.data;
                            console.log('User data fetched:', this.userData);
                        }
                    } catch (error) {
                        console.error('Error fetching user data:', error);
                    }

                    // Fetch the user's itinerary
                    await this.fetchItinerary();
                    this.fetchSpots();
                })
                .catch(error => {
                    console.error('Login error:', error);
                    this.loginError = error.message;
                })
                .finally(() => {
                    this.isLoading = false;
                });
        },

        handleSignup() {
            // Immediately clear any previous errors
            this.signupError = '';

            // Perform validation
            if (!this.validateForm()) {
                // Force Vue to update the DOM
                this.$forceUpdate();

                // Scroll to the error message
                setTimeout(() => {
                    const errorElement = document.querySelector('.error-message');
                    if (errorElement) {
                        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 0);

                return;
            }

            // If validation passes, proceed with signup
            this.isLoading = true;

            // Convert selectedCategories from Proxy to regular array
            const categoriesArray = [...this.selectedCategories];

            // Prepare user data
            const userData = {
                fullName: this.signupForm.fullName,
                email: this.signupForm.email.toLowerCase(),
                password: this.signupForm.password,
                destinationCity: this.signupForm.destinationCity,
                preferences: categoriesArray
            };

            console.log('Sending registration request:', {
                ...userData,
                password: '[REDACTED]', // Don't log the actual password
                preferences: categoriesArray
            });

            // Send registration request to server
            fetch(`${this.apiBaseUrl}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(userData)
            })
                .then(response => {
                    console.log('Registration response status:', response.status);
                    console.log('Registration response headers:', response.headers);

                    if (!response.ok) {
                        return response.json().then(data => {
                            console.log('Registration error response:', data);
                            throw new Error(data.message || 'Registration failed');
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Registration successful:', data);
                    // Registration successful
                    this.isAuthenticated = true;
                    this.currentUserEmail = data.user.email;
                    this.userCategories = data.user.preferences || [];
                    this.fetchSpots();
                })
                .catch(error => {
                    console.error('Registration error:', error);
                    this.signupError = error.message || 'Registration failed. Please try again.';
                })
                .finally(() => {
                    this.isLoading = false;
                });
        },

        handleLogout() {
            this.isAuthenticated = false;
            this.currentPage = 'login';
            this.itinerary = [];
            this.userCategories = [];
            this.selectedCategories = [];
            this.experiences = [];
            this.error = null;
        },

        addToItinerary(experience) {
            if (!this.itinerary.some(item => item.spotId === experience.spotId)) {
                this.itinerary.push(experience);
            }
        },

        handlePreferencesChange() {
            this.preferencesChanged = true;
        },

        async savePreferences() {
            try {
                this.isLoading = true;
                this.error = null;
                console.log('Saving preferences:', this.userCategories);

                if (!this.currentUserEmail) {
                    throw new Error('User email not found. Please log in again.');
                }

                console.log('Updating preferences for user:', this.currentUserEmail);

                const response = await fetch(`/api/users/${this.currentUserEmail}/preferences`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        preferences: this.userCategories
                    })
                });

                console.log('Response status:', response.status);
                console.log('Response headers:', response.headers);

                let data;
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    const text = await response.text();
                    console.error('Non-JSON response:', text);
                    throw new Error('Server returned non-JSON response');
                }

                if (!response.ok) {
                    throw new Error(data.message || 'Failed to save preferences');
                }

                console.log('Preferences saved successfully:', data);

                // Show success message
                this.error = 'Preferences saved successfully!';
                setTimeout(() => {
                    this.error = null;
                }, 3000);

                this.preferencesChanged = false;
                if (this.currentView === 'browse-recommended') {
                    await this.fetchRecommendedSpots();
                }
            } catch (error) {
                console.error('Error saving preferences:', error);
                this.error = error.message || 'Failed to save preferences. Please try again.';
            } finally {
                this.isLoading = false;
            }
        },

        toggleSortOrder() {
            this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        },

        isInItinerary(experience) {
            return this.itinerary.some(item => item.spotId === experience.spotId);
        },

        async toggleItinerary(experience) {
            if (this.isInItinerary(experience)) {
                // Remove from itinerary
                this.itinerary = this.itinerary.filter(item => item.spotId !== experience.spotId);
            } else {
                // Add to itinerary
                this.itinerary.push({
                    ...experience,
                    date: new Date().toLocaleDateString('en-GB'),
                    status: 'pending'
                });
            }
            // Save the updated itinerary
            await this.saveItinerary();
        },

        async removeFromItinerary(index) {
            this.itinerary.splice(index, 1);
            // Save the updated itinerary
            await this.saveItinerary();
        },

        dragStart(index) {
            this.draggedIndex = index;
        },

        async drop(index) {
            const draggedItem = this.itinerary[this.draggedIndex];
            this.itinerary.splice(this.draggedIndex, 1);
            this.itinerary.splice(index, 0, draggedItem);
            // Save the reordered itinerary
            await this.saveItinerary();
        },

        async saveItinerary() {
            try {
                console.log('Saving itinerary for user:', this.currentUserEmail);
                console.log('Current itinerary:', this.itinerary);

                const itineraryData = {
                    emailId: this.currentUserEmail,
                    spots: this.itinerary.map(spot => ({
                        spotId: spot.spotId,
                        title: spot.title,
                        price: spot.price || 0,
                        date: spot.date || new Date().toLocaleDateString('en-GB'),
                        status: spot.status || 'pending'
                    })),
                    totalCost: this.itinerary.reduce((sum, spot) => sum + (spot.price || 0), 0),
                    createdAt: new Date().toLocaleDateString('en-GB'),
                    updatedAt: new Date().toLocaleDateString('en-GB')
                };

                console.log('Sending itinerary data:', itineraryData);

                const response = await fetch(`${this.apiBaseUrl}/itineraries`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(itineraryData)
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Failed to save itinerary');
                }

                console.log('Itinerary saved successfully:', data);
            } catch (error) {
                console.error('Error saving itinerary:', error);
                throw error;
            }
        },

        async fetchItinerary() {
            try {
                console.log('Fetching itinerary for user:', this.currentUserEmail);
                
                if (!this.currentUserEmail) {
                    console.log('No user email found, setting empty itinerary');
                    this.itinerary = [];
                    this.totalCost = 0;
                    return;
                }

                try {
                    const data = await this.makeRequest(`${this.apiBaseUrl}/itineraries/${this.currentUserEmail}`);
                    console.log('Fetched itinerary data:', data);
                    this.itinerary = data.data;
                    this.totalCost = this.calculateTotalCost();
                } catch (error) {
                    if (error.message.includes('404')) {
                        console.log('No existing itinerary found for user:', this.currentUserEmail);
                        this.itinerary = [];
                        this.totalCost = 0;
                    } else {
                        throw error;
                    }
                }
            } catch (error) {
                console.error('Error fetching itinerary:', error);
                this.itinerary = [];
                this.totalCost = 0;
            }
        },

        async handleBooking(spot) {
            try {
                // Open the website in a new tab
                if (spot.website) {
                    window.open(spot.website, '_blank');
                }

                // Update the status to 'booked'
                const index = this.itinerary.findIndex(item => item.spotId === spot.spotId);
                if (index !== -1) {
                    this.itinerary[index].status = 'booked';

                    // Update the itinerary in MongoDB using the correct endpoint
                    const response = await fetch(`${this.apiBaseUrl}/itineraries`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            emailId: this.currentUserEmail,
                            spots: this.itinerary.map(spot => ({
                                spotId: spot.spotId,
                                title: spot.title,
                                price: spot.price || 0,
                                date: spot.date || new Date().toLocaleDateString('en-GB'),
                                status: spot.status || 'pending'
                            })),
                            totalCost: this.itinerary.reduce((sum, spot) => sum + (spot.price || 0), 0),
                            createdAt: new Date().toLocaleDateString('en-GB'),
                            updatedAt: new Date().toLocaleDateString('en-GB')
                        })
                    });

                    if (!response.ok) {
                        throw new Error('Failed to update itinerary status');
                    }

                    console.log('Booking status updated successfully');
                }
            } catch (error) {
                console.error('Error handling booking:', error);
            }
        },

        showReviewModal(spot) {
            console.log('showReviewModal called with spot:', spot);
            if (!spot) {
                console.error('No spot provided to showReviewModal');
                return;
            }
            if (spot.status !== 'booked') {
                console.error('Spot is not booked:', spot.status);
                return;
            }
            console.log('Opening review modal for spot:', spot.title);
            this.currentReviewSpot = spot;
            this.showReviewPopup = true;
            this.showReviewForm = false;
            this.reviewForm = {
                rating: 0,
                comment: ''
            };
        },

        closeReviewModal() {
            console.log('Closing review modal');
            this.showReviewPopup = false;
            this.showReviewForm = false;
            this.currentReviewSpot = null;
            this.reviewForm = {
                rating: 0,
                comment: ''
            };
        },

        proceedToReview() {
            console.log('Proceeding to review form');
            this.showReviewForm = true;
        },

        async skipReview() {
            console.log('Skipping review');
            if (!this.currentReviewSpot) {
                console.error('No current review spot when skipping review');
                this.closeReviewModal();
                return;
            }

            const index = this.itinerary.findIndex(item => item.spotId === this.currentReviewSpot.spotId);
            if (index !== -1) {
                console.log('Removing spot from itinerary:', this.currentReviewSpot.title);
                this.itinerary.splice(index, 1);
                // Save the updated itinerary to MongoDB
                await this.saveItinerary();
            }
            this.closeReviewModal();
        },

        async submitReview() {
            console.log('Submitting review');
            try {
                if (!this.currentReviewSpot) {
                    console.error('No current review spot when submitting review');
                    return;
                }
                if (this.reviewForm.rating === 0) {
                    console.error('No rating provided');
                    return;
                }

                console.log('Saving review to MongoDB:', {
                    emailId: this.currentUserEmail,
                    spotId: this.currentReviewSpot.spotId,
                    rating: this.reviewForm.rating,
                    comment: this.reviewForm.comment
                });

                // Save review to MongoDB
                const response = await fetch(`${this.apiBaseUrl}/reviews`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        emailId: this.currentUserEmail,
                        spotId: this.currentReviewSpot.spotId,
                        rating: this.reviewForm.rating,
                        comment: this.reviewForm.comment,
                        createdAt: new Date().toLocaleDateString('en-GB')
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Failed to save review:', errorData);
                    throw new Error('Failed to save review');
                }

                // Remove spot from itinerary
                const index = this.itinerary.findIndex(item => item.spotId === this.currentReviewSpot.spotId);
                if (index !== -1) {
                    console.log('Removing reviewed spot from itinerary:', this.currentReviewSpot.title);
                    this.itinerary.splice(index, 1);
                }

                this.closeReviewModal();
                console.log('Review submitted successfully');
            } catch (error) {
                console.error('Error submitting review:', error);
            }
        },

        handleReview(item) {
            if (confirm('Would you like to leave a review for this attraction?')) {
                const rating = prompt('Please rate this attraction (1-5 stars):');
                if (rating && rating >= 1 && rating <= 5) {
                    const comment = prompt('Please leave a comment about your experience:');
                    if (comment) {
                        // Submit review
                        fetch(`${this.apiBaseUrl}/api/reviews`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                emailId: this.currentUserEmail,
                                spotId: item.spotId,
                                rating: parseInt(rating),
                                comment: comment
                            })
                        })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    console.log('Review submitted successfully');
                                    // Remove from itinerary
                                    this.itinerary = this.itinerary.filter(spot => spot.spotId !== item.spotId);
                                    // Save updated itinerary
                                    this.saveItinerary();
                                } else {
                                    console.error('Failed to submit review:', data.message);
                                }
                            })
                            .catch(error => {
                                console.error('Error submitting review:', error);
                            });
                    }
                } else {
                    console.log('Invalid rating provided');
                }
            } else {
                // User clicked "No" - remove from itinerary and save
                this.itinerary = this.itinerary.filter(spot => spot.spotId !== item.spotId);
                this.saveItinerary();
            }
        },

        async showReviews(spot) {
            this.currentReviewsSpot = spot;
            this.showReviewsModal = true;
            this.reviewsSortBy = 'date';
            this.reviewsSortOrder = 'desc';

            try {
                const response = await fetch(`${this.apiBaseUrl}/reviews/${spot.spotId}`);
                const data = await response.json();

                if (data.success) {
                    this.spotReviews = data.reviews;
                } else {
                    console.error('Failed to fetch reviews:', data.message);
                    this.spotReviews = [];
                }
            } catch (error) {
                console.error('Error fetching reviews:', error);
                this.spotReviews = [];
            }
        },

        closeReviewsModal() {
            this.showReviewsModal = false;
            this.currentReviewsSpot = null;
            this.spotReviews = [];
        },

        sortReviews() {
            // The sorting is handled by the computed property
        },

        toggleReviewsSortOrder() {
            this.reviewsSortOrder = this.reviewsSortOrder === 'asc' ? 'desc' : 'asc';
        }
    }
});

app.mount('#app');