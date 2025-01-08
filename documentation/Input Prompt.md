Provocative Cloud is a platform for users to rent GPUs owned by Provocative by the hour.

**User Dashboard:**  
Users can log in through a web-based interface, see a list of available GPUs, their specs (including RAM, storage, GPU type and count, CPU specs, and bandwidth), and pricing options. Users can reserve one or more GPUs on a server (priced in dollars per GPU-hour) for as little as one hour and as much as six months. The user dashboard should include reporting on their rented GPUs including time rented, time left on a reservation, auto-renewal of the reservation (set to default renew), and GPU health metrics like temperature and clock speed.

**Payment:**  
Users should be able to rent GPUs by connecting with Stripe and paying in advance, which will require a payment integration on the back end of this product. The user dashboard should include information about historical purchases and available credits.

**Host Dashboard:**  
A host dashboard should allow the host to add GPU servers, unlist them for maintenance, and remove them entirely. It should allow the host to set prices by individual GPU, by GPU-type, or by server. It should report current health metrics by GPU, historical up-time and rental metrics, and historical prices both by GPU and aggregated.

**Backend:**  
Each server will be running Ubuntu server 20.04. Servers should be managed by software that partitions the drive and runs a daemon that reports back to a central server which hosts information about GPU inventory and reports to both the Host Dashboard and User Dashboard.

Users should be able to deploy a server with one or more GPUs, SSH into the server, deploy a Docker container of their making or otherwise run their own software with access to the GPUs in a virtual machine.

**Homepage and Login:**  
Provocative Cloud requires a home page that explains the product and the company, allows users to sign in with OAuth through Google, and allows them to connect their accounts via Stripe.

**Other features:**  
1\. Persistent storage: provides persistent storage options on a server for users who need to save data across sessions  
2\. Automated shutdown: includes options for automatic shutdown when idle to prevent unnecessary costs  
3\. Jupyter Access: supports direct SSH and web-based Jupyter notebooks for interactive development  
4\. Multi-GPU and distributed training: allows renting multiple GPUs for large-scale or distributed training workloads

**About Provocative:**  
Provocative builds AI cloud data centers that capture CO2. We manage and rent servers primarily for inference and AI/ML models, cool servers with a tremendous amount of air flow, and capture carbon dioxide from the air flow thus offsetting the carbon footprint of running AI models.