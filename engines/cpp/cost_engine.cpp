#include <iostream>
#include <string>
#include <stdexcept>

// GCC/Clang implementation. Integer minor units and quantity thousandths.
static unsigned long long number(const char* input) {
    std::string value(input);
    if(value.empty() || value.find_first_not_of("0123456789")!=std::string::npos) throw std::invalid_argument("Nonnegative integer input required");
    auto n=std::stoull(value);
    if(n>9007199254740991ULL) throw std::invalid_argument("Supported range exceeded");
    return n;
}
int main(int argc,char** argv) {
    try {
        if(argc!=4) throw std::invalid_argument("Use stockValueMinor heldQuantityMilli soldQuantityMilli");
        auto value=number(argv[1]),held=number(argv[2]),sold=number(argv[3]);
        if(!held || !sold || sold>held) throw std::invalid_argument("Invalid held/sold quantities");
        unsigned __int128 numerator=static_cast<unsigned __int128>(value)*sold;
        auto cost=sold==held?value:static_cast<unsigned long long>((numerator+held/2)/held);
        std::cout<<"{\"cost\":"<<cost<<",\"remainingValue\":"<<(value-cost)<<",\"remainingQuantity\":"<<(held-sold)<<"}\n";
        return 0;
    } catch(const std::exception& error) { std::cerr<<error.what()<<'\n';return 1; }
}
